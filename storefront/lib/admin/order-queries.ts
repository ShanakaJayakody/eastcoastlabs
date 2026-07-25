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

export interface OrderListFilters {
  status?: OrderStatus | "all";
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

  if (status !== "all") q = q.eq("status", status);
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
