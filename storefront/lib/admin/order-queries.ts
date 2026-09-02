/** Read-side queries for the orders module. Mutations live in orders.ts. */
import { adminDb } from "./db";
import type { OrderStatus } from "./orders";

export interface OrderListRow {
  id: string;
  order_number: string;
  status: OrderStatus;
  customer_email: string;
  customer_name: string | null;
  total_cents: number;
  created_at: string;
  item_count: number;
}

/** "to_fulfil" is the operator's real default: paid work waiting to go out. */
export type OrderFilter = OrderStatus | "all" | "to_fulfil";

export const TO_FULFIL: OrderStatus[] = ["paid", "processing"];

export interface OrderListFilters {
  status?: OrderFilter;
  search?: string;
  limit?: number;
  offset?: number;
}

export async function listOrders(
  filters: OrderListFilters = {},
): Promise<{ rows: OrderListRow[]; total: number }> {
  const { status = "all", search, limit = 25, offset = 0 } = filters;
  let q = adminDb()
    .from("orders")
    .select("id, order_number, status, customer_email, customer_name, total_cents, created_at, order_items(count)", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status === "to_fulfil") q = q.in("status", TO_FULFIL);
  else if (status !== "all") q = q.eq("status", status);
  if (search?.trim()) {
    const s = search.trim();
    q = q.or(`order_number.ilike.%${s}%,customer_email.ilike.%${s}%,customer_name.ilike.%${s}%`);
  }

  const { data, count, error } = await q;
  if (error) throw new Error(`listOrders: ${error.message}`);

  const rows = (data ?? []).map((r) => {
    const rec = r as unknown as OrderListRow & { order_items: { count: number }[] };
    return { ...rec, item_count: rec.order_items?.[0]?.count ?? 0 };
  });
  return { rows, total: count ?? 0 };
}

/**
 * Row counts per status (plus the to_fulfil and all rollups) so the filter tabs
 * can show live numbers — a queue you can't count isn't a queue.
 */
export async function orderStatusCounts(): Promise<Record<string, number>> {
  const { data, error } = await adminDb().from("orders").select("status");
  if (error) throw new Error(`orderStatusCounts: ${error.message}`);
  const counts: Record<string, number> = { all: 0, to_fulfil: 0 };
  for (const row of data ?? []) {
    const s = row.status as OrderStatus;
    counts[s] = (counts[s] ?? 0) + 1;
    counts.all += 1;
    if (TO_FULFIL.includes(s)) counts.to_fulfil += 1;
  }
  return counts;
}

export interface OrderDetail {
  id: string;
  order_number: string;
  status: OrderStatus;
  customer_email: string;
  customer_name: string | null;
  shipping_address: Record<string, string | null> | null;
  subtotal_cents: number;
  discount_cents: number;
  shipping_cents: number;
  total_cents: number;
  discount_code: string | null;
  payment_method: string | null;
  payment_ref: string | null;
  tracking_number: string | null;
  notes: string | null;
  stock_settled: boolean;
  refunded_cents: number;
  created_at: string;
  paid_at: string | null;
  shipped_at: string | null;
  items: {
    id: string;
    variant_id: string | null;
    product_name: string | null;
    product_slug: string | null;
    variant_label: string | null;
    sku: string | null;
    unit_price_cents: number;
    qty: number;
    line_total_cents: number;
    refunded_qty: number;
    refunded_cents: number;
  }[];
  events: {
    type: string;
    from_status: string | null;
    to_status: string | null;
    message: string | null;
    actor_email: string | null;
    created_at: string;
  }[];
}

export async function getOrder(id: string): Promise<OrderDetail | null> {
  const db = adminDb();
  const { data: order, error } = await db.from("orders").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`getOrder: ${error.message}`);
  if (!order) return null;

  const [{ data: items }, { data: events }] = await Promise.all([
    db
      .from("order_items")
      .select(
        "id, variant_id, product_name, product_slug, variant_label, sku, unit_price_cents, qty, line_total_cents, refunded_qty, refunded_cents",
      )
      .eq("order_id", id),
    db
      .from("order_events")
      .select("type, from_status, to_status, message, actor_email, created_at")
      .eq("order_id", id)
      .order("created_at", { ascending: true }),
  ]);

  return {
    ...(order as unknown as OrderDetail),
    items: (items ?? []) as OrderDetail["items"],
    events: (events ?? []) as OrderDetail["events"],
  };
}

/** Dashboard metrics: revenue windows + fulfilment queue. */
export async function orderMetrics(): Promise<{
  revenueToday: number;
  revenue7d: number;
  revenue30d: number;
  toFulfil: number;
  pendingPayment: number;
}> {
  const db = adminDb();
  const PAID: OrderStatus[] = ["paid", "processing", "shipped", "completed"];
  const since = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString();
  };
  const startOfToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  };

  const sum = async (fromIso: string): Promise<number> => {
    const { data } = await db
      .from("orders")
      .select("total_cents")
      .in("status", PAID)
      .gte("created_at", fromIso);
    return (data ?? []).reduce((s, r) => s + (r.total_cents as number), 0);
  };

  const [revenueToday, revenue7d, revenue30d] = await Promise.all([
    sum(startOfToday()),
    sum(since(7)),
    sum(since(30)),
  ]);

  const { count: toFulfil } = await db
    .from("orders")
    .select("*", { count: "exact", head: true })
    .in("status", ["paid", "processing"]);
  const { count: pendingPayment } = await db
    .from("orders")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  return {
    revenueToday,
    revenue7d,
    revenue30d,
    toFulfil: toFulfil ?? 0,
    pendingPayment: pendingPayment ?? 0,
  };
}

/* ---------------- Revenue window (dashboard chart) ---------------- */

export type RevenueScale = "month" | "week" | "day";

export interface RevenueBucket {
  label: string;
  cents: number;
}

/**
 * One chart-able slice of paid revenue at a given scale, plus the previous
 * window's total so the header can say "vs August". Anchors are Sydney
 * calendar dates (YYYY-MM-DD) — any date inside the window identifies it.
 */
export interface RevenueWindow {
  scale: RevenueScale;
  anchor: string; // canonical anchor: first day of the window
  title: string; // "September 2026" · "25 – 31 Aug 2026" · "Tue 2 Sep 2026"
  hint: string; // "Month to date" · "Full week" · "Today by hour"
  isCurrent: boolean; // window contains today
  buckets: RevenueBucket[];
  totalCents: number;
  previousTotalCents: number;
  previousLabel: string; // "August" · "last week" · "yesterday" — reads after "vs"
  prevAnchor: string;
  nextAnchor: string | null; // null when already at the current window
}

const TZ = "Australia/Sydney";
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_MS = 24 * 3600 * 1000;

/** A Sydney calendar date. Never a JS Date — those carry an instant, and the
 *  whole point is to do arithmetic on the operator's local calendar. */
interface Civil {
  y: number;
  m: number; // 1-12
  d: number; // 1-31
}

/** Calendar components of an instant in Sydney time. Orders are stored in UTC;
 *  the operator thinks in local days, so all bucketing happens here. */
function sydneyParts(date: Date): Civil & { h: number } {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: TZ,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  return {
    y: parseInt(get("year"), 10),
    m: parseInt(get("month"), 10),
    d: parseInt(get("day"), 10),
    h: parseInt(get("hour"), 10) % 24,
  };
}

/** Proxy instant for calendar arithmetic: the civil date at 00:00 UTC. Only
 *  ever compared with other proxies, never with real order timestamps. */
const proxy = (c: Civil): number => Date.UTC(c.y, c.m - 1, c.d);
const fromProxy = (ms: number): Civil => {
  const d = new Date(ms);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
};
const addDays = (c: Civil, n: number): Civil => fromProxy(proxy(c) + n * DAY_MS);
const addMonths = (c: Civil, n: number): Civil => fromProxy(Date.UTC(c.y, c.m - 1 + n, 1));
const weekday = (c: Civil): number => new Date(proxy(c)).getUTCDay(); // 0 = Sunday
const startOfWeek = (c: Civil): Civil => addDays(c, -((weekday(c) + 6) % 7)); // Monday
const daysInMonth = (c: Civil): number => new Date(Date.UTC(c.y, c.m, 0)).getUTCDate();
const sameDay = (a: Civil, b: Civil): boolean => a.y === b.y && a.m === b.m && a.d === b.d;
const toIso = (c: Civil): string =>
  `${c.y}-${String(c.m).padStart(2, "0")}-${String(c.d).padStart(2, "0")}`;

export function parseRevenueScale(value: string | undefined | null): RevenueScale {
  return value === "week" || value === "day" ? value : "month";
}

/** Strict YYYY-MM-DD on the Sydney calendar. Anything malformed, impossible
 *  (31 Feb), or in the future collapses to today — the URL is user input. */
function parseAnchor(value: string | undefined | null, today: Civil): Civil {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return today;
  const [y, m, d] = value.split("-").map((n) => parseInt(n, 10));
  const c = { y, m, d };
  const roundTrip = fromProxy(proxy(c));
  if (!sameDay(c, roundTrip)) return today;
  return proxy(c) > proxy(today) ? today : c;
}

function hourLabel(h: number): string {
  if (h === 0) return "12am";
  if (h === 12) return "12pm";
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

/** Half-open [start, end) in civil dates for the window containing `anchor`. */
function windowBounds(scale: RevenueScale, anchor: Civil): { start: Civil; end: Civil } {
  if (scale === "month") {
    const start = { y: anchor.y, m: anchor.m, d: 1 };
    return { start, end: addMonths(start, 1) };
  }
  if (scale === "week") {
    const start = startOfWeek(anchor);
    return { start, end: addDays(start, 7) };
  }
  return { start: anchor, end: addDays(anchor, 1) };
}

function stepBack(scale: RevenueScale, start: Civil): Civil {
  if (scale === "month") return addMonths(start, -1);
  if (scale === "week") return addDays(start, -7);
  return addDays(start, -1);
}

function titleFor(scale: RevenueScale, start: Civil, end: Civil): string {
  if (scale === "month") return `${MONTHS_LONG[start.m - 1]} ${start.y}`;
  if (scale === "day") return `${WEEKDAYS_SHORT[weekday(start)]} ${start.d} ${MONTHS_SHORT[start.m - 1]} ${start.y}`;
  const last = addDays(end, -1);
  const sameMonth = start.m === last.m && start.y === last.y;
  const left = sameMonth ? `${start.d}` : `${start.d} ${MONTHS_SHORT[start.m - 1]}${start.y !== last.y ? ` ${start.y}` : ""}`;
  return `${left} – ${last.d} ${MONTHS_SHORT[last.m - 1]} ${last.y}`;
}

/**
 * Bucketed paid revenue for one window at one scale, plus the previous
 * window's total. One DB round trip covers both windows; bucketing is pure JS
 * on the Sydney calendar so the chart and the comparison never disagree.
 */
export async function revenueWindow(input: {
  scale: RevenueScale;
  anchor?: string | null;
}): Promise<RevenueWindow> {
  const now = new Date();
  const todayParts = sydneyParts(now);
  const today: Civil = { y: todayParts.y, m: todayParts.m, d: todayParts.d };
  const scale = input.scale;
  const anchor = parseAnchor(input.anchor, today);

  const { start, end } = windowBounds(scale, anchor);
  const prevStart = stepBack(scale, start);
  const isCurrent = proxy(today) >= proxy(start) && proxy(today) < proxy(end);

  // Fetch [prevStart, end) with a one-day buffer each side to absorb the
  // UTC/AEST offset; exact membership is decided per row in Sydney time.
  const fromIso = new Date(proxy(prevStart) - DAY_MS).toISOString();
  const toIsoBound = new Date(proxy(end) + DAY_MS).toISOString();

  const PAID: OrderStatus[] = ["paid", "processing", "shipped", "completed"];
  const { data, error } = await adminDb()
    .from("orders")
    .select("created_at, total_cents")
    .in("status", PAID)
    .gte("created_at", fromIso)
    .lt("created_at", toIsoBound);
  if (error) throw new Error(`revenueWindow: ${error.message}`);

  // Empty scaffolds first, so zero-revenue periods still chart cleanly. The
  // current window only shows elapsed buckets — future days would be noise.
  let buckets: RevenueBucket[];
  let bucketIndex: (p: Civil & { h: number }) => number;
  if (scale === "month") {
    const count = isCurrent ? today.d : daysInMonth(start);
    buckets = Array.from({ length: count }, (_, i) => ({
      label: `${i + 1} ${MONTHS_SHORT[start.m - 1]}`,
      cents: 0,
    }));
    bucketIndex = (p) => p.d - 1;
  } else if (scale === "week") {
    const count = isCurrent ? Math.round((proxy(today) - proxy(start)) / DAY_MS) + 1 : 7;
    buckets = Array.from({ length: count }, (_, i) => {
      const c = addDays(start, i);
      return { label: sameDay(c, today) ? "Today" : `${WEEKDAYS_SHORT[weekday(c)]} ${c.d}`, cents: 0 };
    });
    bucketIndex = (p) => Math.round((proxy(p) - proxy(start)) / DAY_MS);
  } else {
    buckets = Array.from({ length: 24 }, (_, h) => ({ label: hourLabel(h), cents: 0 }));
    bucketIndex = (p) => p.h;
  }

  let totalCents = 0;
  let previousTotalCents = 0;
  const startMs = proxy(start);
  const endMs = proxy(end);
  const prevStartMs = proxy(prevStart);
  for (const row of data ?? []) {
    const p = sydneyParts(new Date(row.created_at as string));
    const cents = (row.total_cents as number) ?? 0;
    const dayMs = proxy(p);
    if (dayMs >= startMs && dayMs < endMs) {
      const i = bucketIndex(p);
      if (i >= 0 && i < buckets.length) buckets[i].cents += cents;
      totalCents += cents;
    } else if (dayMs >= prevStartMs && dayMs < startMs) {
      previousTotalCents += cents;
    }
  }

  const hint =
    scale === "month"
      ? isCurrent ? "Month to date" : "Full month"
      : scale === "week"
        ? isCurrent ? "Week to date" : "Full week"
        : isCurrent ? "Today by hour" : "By hour";
  const previousLabel =
    scale === "month"
      ? MONTHS_LONG[prevStart.m - 1]
      : scale === "week"
        ? isCurrent ? "last week" : "the week before"
        : isCurrent ? "yesterday" : "the day before";

  return {
    scale,
    anchor: toIso(start),
    title: titleFor(scale, start, end),
    hint,
    isCurrent,
    buckets,
    totalCents,
    previousTotalCents,
    previousLabel,
    prevAnchor: toIso(prevStart),
    nextAnchor: isCurrent ? null : toIso(end),
  };
}
