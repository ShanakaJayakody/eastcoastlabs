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

/* ---------------- Revenue series (dashboard chart) ---------------- */

export interface RevenueBucket {
  label: string;
  cents: number;
}

export interface RevenueSeries {
  month: RevenueBucket[]; // current calendar month, one bucket per elapsed day
  week: RevenueBucket[]; // last 7 days incl. today, one per day
  day: RevenueBucket[]; // today, one per hour
}

const TZ = "Australia/Sydney";
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Calendar components of an instant in Sydney time. Orders are stored in UTC;
 *  the operator thinks in local days, so all bucketing happens here. */
function sydneyParts(date: Date): { y: number; m: number; d: number; h: number; weekday: string } {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: TZ,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    hour12: false,
    weekday: "short",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  return {
    y: parseInt(get("year"), 10),
    m: parseInt(get("month"), 10),
    d: parseInt(get("day"), 10),
    h: parseInt(get("hour"), 10) % 24,
    weekday: get("weekday"),
  };
}

function hourLabel(h: number): string {
  if (h === 0) return "12am";
  if (h === 12) return "12pm";
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

/**
 * Bucketed paid revenue for the dashboard chart: current month by day,
 * last 7 days by day, today by hour — all in Sydney time. One DB round trip;
 * bucketing is pure JS so the three views stay perfectly consistent.
 */
export async function revenueSeries(): Promise<RevenueSeries> {
  const now = new Date();
  const today = sydneyParts(now);

  // Fetch window: whichever reaches further back — start of the Sydney month
  // or 7 days ago — with a 2-day buffer to absorb the UTC/AEST offset.
  const monthStartApprox = new Date(Date.UTC(today.y, today.m - 1, 1));
  monthStartApprox.setUTCDate(monthStartApprox.getUTCDate() - 2);
  const weekStartApprox = new Date(now.getTime() - 9 * 24 * 3600 * 1000);
  const from = monthStartApprox < weekStartApprox ? monthStartApprox : weekStartApprox;

  const PAID: OrderStatus[] = ["paid", "processing", "shipped", "completed"];
  const { data, error } = await adminDb()
    .from("orders")
    .select("created_at, total_cents")
    .in("status", PAID)
    .gte("created_at", from.toISOString());
  if (error) throw new Error(`revenueSeries: ${error.message}`);

  // Empty scaffolds first, so zero-revenue periods still chart cleanly.
  const month: RevenueBucket[] = Array.from({ length: today.d }, (_, i) => ({
    label: `${i + 1} ${MONTHS_SHORT[today.m - 1]}`,
    cents: 0,
  }));

  const weekKeys: string[] = [];
  const week: RevenueBucket[] = [];
  for (let i = 6; i >= 0; i--) {
    const p = sydneyParts(new Date(now.getTime() - i * 24 * 3600 * 1000));
    weekKeys.push(`${p.y}-${p.m}-${p.d}`);
    week.push({ label: i === 0 ? "Today" : `${p.weekday} ${p.d}`, cents: 0 });
  }

  const day: RevenueBucket[] = Array.from({ length: 24 }, (_, h) => ({
    label: hourLabel(h),
    cents: 0,
  }));

  for (const row of data ?? []) {
    const p = sydneyParts(new Date(row.created_at as string));
    const cents = (row.total_cents as number) ?? 0;

    if (p.y === today.y && p.m === today.m && p.d <= today.d) {
      month[p.d - 1].cents += cents;
    }
    const wi = weekKeys.indexOf(`${p.y}-${p.m}-${p.d}`);
    if (wi >= 0) week[wi].cents += cents;
    if (p.y === today.y && p.m === today.m && p.d === today.d) {
      day[p.h].cents += cents;
    }
  }

  return { month, week, day };
}
