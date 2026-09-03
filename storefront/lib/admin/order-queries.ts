/** Read-side queries for the orders module. Mutations live in orders.ts. */
import { adminDb } from "./db";
import { csvRow } from "@/lib/csv";
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

/** Columns the list can be sorted by. Anything else falls back to `created_at`. */
export type OrderSort = "created_at" | "total_cents" | "order_number" | "status";

const SORTABLE: OrderSort[] = ["created_at", "total_cents", "order_number", "status"];

export function parseOrderSort(value: string | undefined | null): OrderSort {
  return SORTABLE.includes(value as OrderSort) ? (value as OrderSort) : "created_at";
}

/**
 * A `YYYY-MM-DD` Sydney date as a UTC instant.
 *
 * `end: true` returns the first instant of the *next* day, so a filter can be
 * half-open and still include everything the operator typed as the last day.
 * Anything malformed returns null, which callers read as "no bound" — the
 * value comes from the URL and must never throw the page.
 */
export function sydneyDayBoundary(value: string | undefined | null, end = false): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map((n) => parseInt(n, 10));
  const civil = { y, m, d };
  if (toIso(fromProxy(proxy(civil))) !== value) return null;
  const target = end ? addDays(civil, 1) : civil;
  // Sydney is UTC+10, or UTC+11 on daylight time. Probe the real offset for
  // that date rather than assuming, so a filter never slips by an hour.
  const guess = new Date(Date.UTC(target.y, target.m - 1, target.d, 0, 0, 0));
  for (const offsetHours of [10, 11]) {
    const candidate = new Date(guess.getTime() - offsetHours * 3_600_000);
    if (sydneyDayKey(candidate) === toIso(target)) {
      const parts = sydneyParts(candidate);
      if (parts.h === 0) return candidate.toISOString();
    }
  }
  return new Date(guess.getTime() - 10 * 3_600_000).toISOString();
}

export interface OrderListFilters {
  status?: OrderFilter;
  search?: string;
  limit?: number;
  offset?: number;
  /** Inclusive Sydney date, `YYYY-MM-DD`. */
  from?: string | null;
  /** Inclusive Sydney date, `YYYY-MM-DD`. */
  to?: string | null;
  sort?: OrderSort;
  dir?: "asc" | "desc";
}

export async function listOrders(
  filters: OrderListFilters = {},
): Promise<{ rows: OrderListRow[]; total: number }> {
  const {
    status = "all",
    search,
    limit = 25,
    offset = 0,
    from,
    to,
    sort = "created_at",
    dir = "desc",
  } = filters;
  let q = adminDb()
    .from("orders")
    .select("id, order_number, status, customer_email, customer_name, total_cents, created_at, order_items(count)", {
      count: "exact",
    })
    .order(sort, { ascending: dir === "asc" })
    .range(offset, offset + limit - 1);

  if (status === "to_fulfil") q = q.in("status", TO_FULFIL);
  else if (status !== "all") q = q.eq("status", status);

  const fromIso = sydneyDayBoundary(from);
  const toIsoBound = sydneyDayBoundary(to, true);
  if (fromIso) q = q.gte("created_at", fromIso);
  if (toIsoBound) q = q.lt("created_at", toIsoBound);
  if (search?.trim()) {
    // Commas separate conditions in a PostgREST .or() and parens group them, so
    // an unescaped one produces a 400 and a 500 page. With live search this now
    // fires per keystroke, not on an explicit submit.
    const s = search.trim().replace(/[,()]/g, "");
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
  /** Net revenue minus COGS for the same bucket. Can be negative. */
  profitCents: number;
}

/**
 * Money for one window. Revenue is gross takings on paid orders; profit is
 * net-of-refunds revenue minus the COGS snapshot frozen at payment. Shipping
 * cost and payment fees are not tracked anywhere, so they are not deducted —
 * this is gross profit, and `uncostedLines` says how much of it is guesswork.
 */
export interface RevenueTotals {
  revenueCents: number;
  refundedCents: number;
  cogsCents: number;
  profitCents: number;
  /** Unpaid orders raised in the window — takings not yet in the bank. */
  pendingCents: number;
  pendingCount: number;
  /** Sold lines with no cost snapshot. Profit is overstated by their cost. */
  uncostedLines: number;
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
  totals: RevenueTotals;
  previousTotals: RevenueTotals;
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

/** The Sydney calendar date of an instant, as `YYYY-MM-DD`. */
export function sydneyDayKey(date: Date): string {
  const p = sydneyParts(date);
  return toIso({ y: p.y, m: p.m, d: p.d });
}

/**
 * The last `days` Sydney calendar dates, oldest first, ending today.
 *
 * Callers bucket by these keys rather than by dividing elapsed milliseconds:
 * a day is not always 86,400,000 ms, and on the October DST change that
 * arithmetic folds two dates onto one index and leaves the newest day empty.
 */
export function sydneyRecentDayKeys(days: number): string[] {
  const today = sydneyParts(new Date());
  const start = addDays({ y: today.y, m: today.m, d: today.d }, -(days - 1));
  return Array.from({ length: days }, (_, i) => toIso(addDays(start, i)));
}

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
 * Everything about a window except the money in it.
 *
 * Shared so the reports area steps through periods by exactly the same calendar
 * rules as the revenue chart — a "September" that means two different spans on
 * two screens is worse than having no reports at all.
 */
export interface WindowMeta {
  scale: RevenueScale;
  /** Canonical anchor: first day of the window, Sydney calendar. */
  anchor: string;
  title: string;
  hint: string;
  isCurrent: boolean;
  prevAnchor: string;
  nextAnchor: string | null;
  previousLabel: string;
  /** Half-open UTC instants covering the window itself. */
  startIso: string;
  endIso: string;
}

export function windowMeta(scale: RevenueScale, anchorInput?: string | null): WindowMeta {
  const todayParts = sydneyParts(new Date());
  const today: Civil = { y: todayParts.y, m: todayParts.m, d: todayParts.d };
  const anchor = parseAnchor(anchorInput, today);
  const { start, end } = windowBounds(scale, anchor);
  const prevStart = stepBack(scale, start);
  const isCurrent = proxy(today) >= proxy(start) && proxy(today) < proxy(end);

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
    prevAnchor: toIso(prevStart),
    nextAnchor: isCurrent ? null : toIso(end),
    previousLabel,
    // Boundaries probe the real Sydney offset for the date, so these are exact
    // rather than assuming +10:00 year-round.
    // `toIso` always yields a well-formed date, so the boundary never comes back
    // null here; the fallback exists only to satisfy the type.
    startIso: sydneyDayBoundary(toIso(start)) ?? new Date(proxy(start)).toISOString(),
    endIso: sydneyDayBoundary(toIso(end)) ?? new Date(proxy(end)).toISOString(),
  };
}

/**
 * Bucketed paid revenue for one window at one scale, plus the previous
 * window's total. Two DB round trips — orders, then the COGS snapshot keyed on
 * the ids that came back — covering both windows at once. Bucketing is pure JS
 * on the Sydney calendar so the chart and the comparison never disagree.
 *
 * Refunds are attributed to the day the order was raised, not the day the money
 * went back. Revenue and its refund therefore always sit in the same bucket,
 * which is what makes a closed month's figures stable.
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

  // "refunded" belongs here: a fully-refunded order is still a sale that
  // happened, and dropping it would make a closed month's revenue shrink
  // retroactively with nothing in the Refunds cell to explain the gap.
  const PAID: OrderStatus[] = ["paid", "processing", "shipped", "completed", "refunded"];
  const db = adminDb();
  const { data, error } = await db
    .from("orders")
    .select("id, created_at, total_cents, refunded_cents, status")
    .in("status", [...PAID, "pending"])
    .gte("created_at", fromIso)
    .lt("created_at", toIsoBound);
  if (error) throw new Error(`revenueWindow: ${error.message}`);
  const orders = (data ?? []) as unknown as {
    id: string;
    created_at: string;
    total_cents: number;
    refunded_cents: number | null;
    status: OrderStatus;
  }[];

  // Second and last query: the COGS snapshot for every order in range. Cost is
  // frozen per line at payment, so historical profit never moves when a
  // supplier reprices — see costs.ts.
  const cogsByOrder = new Map<string, number>();
  const uncostedByOrder = new Map<string, number>();
  const paidIds = orders.filter((o) => o.status !== "pending").map((o) => o.id);
  if (paidIds.length) {
    const { data: lines, error: lineError } = await db
      .from("order_items")
      .select("order_id, qty, refunded_qty, unit_cost_cents")
      .in("order_id", paidIds);
    if (lineError) throw new Error(`revenueWindow lines: ${lineError.message}`);
    for (const line of lines ?? []) {
      const orderId = line.order_id as string;
      const netQty = Math.max(0, (line.qty as number) - ((line.refunded_qty as number) ?? 0));
      if (line.unit_cost_cents == null) {
        if (netQty > 0) uncostedByOrder.set(orderId, (uncostedByOrder.get(orderId) ?? 0) + 1);
        continue;
      }
      cogsByOrder.set(orderId, (cogsByOrder.get(orderId) ?? 0) + (line.unit_cost_cents as number) * netQty);
    }
  }

  // Empty scaffolds first, so zero-revenue periods still chart cleanly. The
  // current window only shows elapsed buckets — future days would be noise.
  let buckets: RevenueBucket[];
  let bucketIndex: (p: Civil & { h: number }) => number;
  if (scale === "month") {
    const count = isCurrent ? today.d : daysInMonth(start);
    buckets = Array.from({ length: count }, (_, i) => ({
      label: `${i + 1} ${MONTHS_SHORT[start.m - 1]}`,
      cents: 0,
      profitCents: 0,
    }));
    bucketIndex = (p) => p.d - 1;
  } else if (scale === "week") {
    const count = isCurrent ? Math.round((proxy(today) - proxy(start)) / DAY_MS) + 1 : 7;
    buckets = Array.from({ length: count }, (_, i) => {
      const c = addDays(start, i);
      return {
        label: sameDay(c, today) ? "Today" : `${WEEKDAYS_SHORT[weekday(c)]} ${c.d}`,
        cents: 0,
        profitCents: 0,
      };
    });
    bucketIndex = (p) => Math.round((proxy(p) - proxy(start)) / DAY_MS);
  } else {
    buckets = Array.from({ length: 24 }, (_, h) => ({ label: hourLabel(h), cents: 0, profitCents: 0 }));
    bucketIndex = (p) => p.h;
  }

  const emptyTotals = (): RevenueTotals => ({
    revenueCents: 0,
    refundedCents: 0,
    cogsCents: 0,
    profitCents: 0,
    pendingCents: 0,
    pendingCount: 0,
    uncostedLines: 0,
  });
  const totals = emptyTotals();
  const previousTotals = emptyTotals();

  const startMs = proxy(start);
  const endMs = proxy(end);
  const prevStartMs = proxy(prevStart);

  for (const row of orders) {
    const p = sydneyParts(new Date(row.created_at));
    const dayMs = proxy(p);
    const inWindow = dayMs >= startMs && dayMs < endMs;
    const inPrevious = !inWindow && dayMs >= prevStartMs && dayMs < startMs;
    if (!inWindow && !inPrevious) continue;
    const bucket = inWindow ? totals : previousTotals;

    // Unpaid orders are money owed, never revenue — they must not reach the
    // chart or the profit line until the transfer lands.
    if (row.status === "pending") {
      bucket.pendingCents += row.total_cents ?? 0;
      bucket.pendingCount += 1;
      continue;
    }

    const cents = row.total_cents ?? 0;
    const refunded = row.refunded_cents ?? 0;
    const cogs = cogsByOrder.get(row.id) ?? 0;
    const profit = cents - refunded - cogs;

    bucket.revenueCents += cents;
    bucket.refundedCents += refunded;
    bucket.cogsCents += cogs;
    bucket.profitCents += profit;
    bucket.uncostedLines += uncostedByOrder.get(row.id) ?? 0;

    if (inWindow) {
      const i = bucketIndex(p);
      if (i >= 0 && i < buckets.length) {
        buckets[i].cents += cents;
        buckets[i].profitCents += profit;
      }
    }
  }

  const totalCents = totals.revenueCents;
  const previousTotalCents = previousTotals.revenueCents;

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
    totals,
    previousTotals,
    previousLabel,
    prevAnchor: toIso(prevStart),
    nextAnchor: isCurrent ? null : toIso(end),
  };
}

/** PostgREST caps a single response (1000 rows by default), so a large export
 *  has to be paged rather than asked for in one go — otherwise the CSV is
 *  silently truncated and reconciles against nothing. */
const EXPORT_PAGE = 500;
const EXPORT_MAX = 20_000;

/**
 * CSV of the current orders view. Takes the same filters as the list so the
 * download is what the operator is looking at, not a different question.
 */
export async function ordersCsv(filters: OrderListFilters = {}): Promise<string> {
  const collected: OrderListRow[] = [];
  for (let offset = 0; offset < EXPORT_MAX; offset += EXPORT_PAGE) {
    const { rows, total } = await listOrders({ ...filters, limit: EXPORT_PAGE, offset });
    collected.push(...rows);
    if (rows.length < EXPORT_PAGE || collected.length >= total) break;
  }
  const head = ["order_number", "status", "customer_name", "customer_email", "items", "total_aud", "placed_at"];
  const lines = collected.map((r) =>
    csvRow([
      r.order_number,
      r.status,
      r.customer_name ?? "",
      r.customer_email,
      r.item_count,
      (r.total_cents / 100).toFixed(2),
      r.created_at,
    ]),
  );
  return [csvRow(head), ...lines].join("\n");
}
