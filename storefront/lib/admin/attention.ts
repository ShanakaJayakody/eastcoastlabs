/**
 * What needs the operator today.
 *
 * The dashboard used to report counts and link away; this module supplies the
 * work itself, in one list, ordered by how long it has been waiting. Every item
 * either carries an action the operator can fire in place, or a link to the one
 * screen where the job actually gets done.
 *
 * Two rules the data forces:
 *   1. Stock is one vial pool per product. A restock item reports the pool, never
 *      a derived pack-tier count — those read as zero while vials are on hand.
 *   2. Nothing here invents history. `dailyCounts` only returns series the
 *      orders and carts tables can actually support.
 */
import { adminDb } from "./db";
import { sydneyDayKey, sydneyRecentDayKeys } from "./order-queries";
import { listAllProducts } from "./products";
import type { OrderStatus } from "./orders";

/** Bank transfers get a day's grace before they count as work. */
const PAYMENT_GRACE_HOURS = 24;
/** A transfer this old is very unlikely to land on its own. */
const PAYMENT_URGENT_HOURS = 72;
/** An order still unpacked after this long is late by ECL's own standard. */
const FULFIL_URGENT_HOURS = 24;

export type AttentionKind = "fulfil" | "payment" | "review" | "restock";

export type AttentionVerb = "ship" | "confirm" | "approve";

export interface AttentionItem {
  id: string;
  kind: AttentionKind;
  /** Primary line, e.g. "#1042 · Jane Doe". */
  title: string;
  /** Secondary line, e.g. "2 items · $189.00". */
  detail: string;
  /** Hours since the item started waiting. Drives urgency. */
  ageHours: number;
  ageLabel: string;
  /**
   * Sort key within a kind, higher first. Age in hours for the time-based
   * kinds; head-count for restock, which has no "went out of stock" timestamp
   * to age from — demand is the honest ranking signal there.
   */
  rank: number;
  urgent: boolean;
  href: string;
  /** Present when the job can be done from the dashboard itself. */
  action?: {
    verb: AttentionVerb;
    label: string;
    /** Row the action mutates — an order id, or a review id. */
    targetId: string;
    /** Written-out consequence for the confirmation dialog. */
    consequence: string;
  };
}

export interface AttentionQueue {
  items: AttentionItem[];
  counts: Record<AttentionKind, number>;
  total: number;
}

const KIND_WEIGHT: Record<AttentionKind, number> = {
  payment: 0,
  fulfil: 1,
  review: 2,
  restock: 3,
};

const aud = (cents: number): string =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(cents / 100);

function hoursSince(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, ms / 3_600_000);
}

/** "4h" / "3 days" / "just now" — enough to feel the wait without a timestamp. */
function ageLabel(hours: number): string {
  if (hours < 1) return "just now";
  if (hours < 24) return `${Math.floor(hours)}h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "1 day" : `${days} days`;
}

const TO_FULFIL: OrderStatus[] = ["paid", "processing"];

/**
 * The attention queue. Every source read fires in one batch — this page's
 * previous incarnation serialised its queries and the whole dashboard waited on
 * the slowest one.
 */
export async function attentionQueue(limit = 8): Promise<AttentionQueue> {
  const db = adminDb();
  const paymentCutoff = new Date(Date.now() - PAYMENT_GRACE_HOURS * 3_600_000).toISOString();

  const [
    fulfilRes,
    paymentRes,
    reviewRes,
    waitlistRes,
    products,
    fulfilTotal,
    paymentTotal,
    reviewTotal,
  ] = await Promise.all([
    db
      .from("orders")
      .select("id, order_number, customer_name, customer_email, total_cents, created_at, paid_at, order_items(count)")
      .in("status", TO_FULFIL)
      .order("created_at", { ascending: true })
      .limit(25),
    db
      .from("orders")
      .select("id, order_number, customer_name, customer_email, total_cents, created_at")
      .eq("status", "pending")
      .lt("created_at", paymentCutoff)
      .order("created_at", { ascending: true })
      .limit(25),
    db
      .from("reviews")
      .select("id, author, rating, title, product_slug, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(25),
    db.from("stock_notifications").select("product_slug").eq("notified", false),
    listAllProducts(),
    // Row limits above cap what we *show*; these count what actually exists, so
    // a 60-order backlog never reports itself as 25.
    db.from("orders").select("*", { count: "exact", head: true }).in("status", TO_FULFIL),
    db
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending")
      .lt("created_at", paymentCutoff),
    db.from("reviews").select("*", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  const items: AttentionItem[] = [];

  for (const row of (fulfilRes.data ?? []) as unknown as {
    id: string;
    order_number: string;
    customer_name: string | null;
    customer_email: string;
    total_cents: number;
    created_at: string;
    paid_at: string | null;
    order_items: { count: number }[];
  }[]) {
    // Age runs from payment, not from order creation — a bank transfer that sat
    // unpaid for a week isn't a week late to pack.
    const hours = hoursSince(row.paid_at ?? row.created_at);
    const lines = row.order_items?.[0]?.count ?? 0;
    items.push({
      id: `fulfil:${row.id}`,
      kind: "fulfil",
      title: `#${row.order_number} · ${row.customer_name || row.customer_email}`,
      detail: `${lines} item${lines === 1 ? "" : "s"} · ${aud(row.total_cents)}`,
      ageHours: hours,
      ageLabel: ageLabel(hours),
      rank: hours,
      urgent: hours >= FULFIL_URGENT_HOURS,
      href: `/admin/orders/${row.id}`,
      action: {
        verb: "ship",
        label: "Mark shipped",
        targetId: row.id,
        consequence: `Order #${row.order_number} moves to shipped and a dispatch email goes to ${row.customer_email}. Add tracking on the order page first if you have it.`,
      },
    });
  }

  for (const row of (paymentRes.data ?? []) as unknown as {
    id: string;
    order_number: string;
    customer_name: string | null;
    customer_email: string;
    total_cents: number;
    created_at: string;
  }[]) {
    const hours = hoursSince(row.created_at);
    items.push({
      id: `payment:${row.id}`,
      kind: "payment",
      title: `#${row.order_number} · ${row.customer_name || row.customer_email}`,
      detail: `${aud(row.total_cents)} unpaid`,
      ageHours: hours,
      ageLabel: ageLabel(hours),
      rank: hours,
      urgent: hours >= PAYMENT_URGENT_HOURS,
      href: `/admin/orders/${row.id}`,
      action: {
        verb: "confirm",
        label: "Confirm payment",
        targetId: row.id,
        consequence: `Marks #${row.order_number} paid for ${aud(row.total_cents)}, decrements stock, and emails a receipt to ${row.customer_email}. Check the transfer has cleared first.`,
      },
    });
  }

  for (const row of (reviewRes.data ?? []) as unknown as {
    id: string;
    author: string;
    rating: number;
    title: string;
    product_slug: string;
    created_at: string;
  }[]) {
    const hours = hoursSince(row.created_at);
    items.push({
      id: `review:${row.id}`,
      kind: "review",
      title: `${row.rating}★ "${row.title}"`,
      detail: `${row.author} on ${row.product_slug}`,
      ageHours: hours,
      ageLabel: ageLabel(hours),
      rank: hours,
      urgent: false,
      href: "/admin/reviews",
      action: {
        verb: "approve",
        label: "Publish",
        targetId: row.id,
        consequence: `Publishes this ${row.rating}-star review by ${row.author} to the ${row.product_slug} page, visible to shoppers immediately.`,
      },
    });
  }

  // Waitlist demand only becomes work when the shelf is actually empty. The
  // pool is vials on the pack_size = 1 variant; per-tier counts are derived and
  // read zero while vials remain, which has confused this exact screen before.
  const demandBySlug = new Map<string, number>();
  for (const row of waitlistRes.data ?? []) {
    const slug = row.product_slug as string;
    demandBySlug.set(slug, (demandBySlug.get(slug) ?? 0) + 1);
  }
  for (const product of products) {
    const waiting = demandBySlug.get(product.slug) ?? 0;
    // Sellable vials, not gross vials: stock held in reservations is already
    // spoken for, and the storefront shows the product sold out.
    const sellable =
      product.variants.find((v) => v.pack_size === 1)?.available ?? product.totalOnHand;
    if (waiting === 0 || sellable > 0) continue;
    items.push({
      id: `restock:${product.slug}`,
      kind: "restock",
      title: product.name,
      detail: `Out of stock · ${waiting} ${waiting === 1 ? "person" : "people"} waiting`,
      // No timestamp exists for "went out of stock", so the label reports demand
      // rather than implying an age the data cannot support.
      ageHours: 0,
      ageLabel: `${waiting} waiting`,
      rank: waiting,
      urgent: waiting >= 5,
      href: `/admin/products/${product.slug}`,
    });
  }

  // Counts come from the exact head queries, not from the truncated item list.
  const counts: Record<AttentionKind, number> = {
    fulfil: fulfilTotal.count ?? 0,
    payment: paymentTotal.count ?? 0,
    review: reviewTotal.count ?? 0,
    restock: items.filter((i) => i.kind === "restock").length,
  };
  const total = counts.fulfil + counts.payment + counts.review + counts.restock;

  // Urgent first, then by kind (money owed before packing before moderation),
  // then oldest first within a kind.
  items.sort((a, b) => {
    if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
    if (a.kind !== b.kind) return KIND_WEIGHT[a.kind] - KIND_WEIGHT[b.kind];
    return b.rank - a.rank;
  });

  return { items: items.slice(0, limit), counts, total };
}

export interface DailySeries {
  /** Oldest first, one entry per day, length = days. */
  points: number[];
  /** Change of the latest 7 days against the 7 before, as a ratio. */
  delta: number | null;
}

export interface DailyCounts {
  /** Orders that became payable per day — the inflow behind the fulfil queue. */
  paidOrders: DailySeries;
  /** Unpaid orders raised per day. */
  pendingOrders: DailySeries;
  /** Carts last touched on that day and still sitting in `active`. */
  abandonedCarts: DailySeries;
}

/**
 * The full series for drawing, plus a like-for-like delta.
 *
 * The delta deliberately drops the last point: today is a part-day, and
 * comparing it against complete days drags every trend downward all morning.
 */
function seriesFrom(points: number[]): DailySeries {
  const complete = points.slice(0, -1);
  const half = Math.floor(complete.length / 2);
  if (half === 0) return { points, delta: null };
  const recent = complete.slice(-half).reduce((a, b) => a + b, 0);
  const prior = complete.slice(-2 * half, -half).reduce((a, b) => a + b, 0);
  return { points, delta: prior > 0 ? (recent - prior) / prior : null };
}

/**
 * Per-day counts for the KPI sparklines.
 *
 * Only series the tables can actually support appear here. Queue *depth* over
 * time (how many orders sat unpacked last Tuesday) is not recorded anywhere, so
 * these are inflow series and the UI labels them as such. Low stock gets no
 * series at all — there is no daily history of it to draw.
 */
export async function dailyCounts(days = 14): Promise<DailyCounts> {
  const db = adminDb();
  // Bucket on Sydney calendar dates, not on elapsed milliseconds. The operator
  // reads these as local days, the server may well be running in UTC, and one
  // day a year is 23 hours long.
  const keys = sydneyRecentDayKeys(days);
  const indexByKey = new Map(keys.map((key, i) => [key, i] as const));
  // Two days of slack absorbs the UTC/AEST offset at both ends of the range.
  const sinceIso = new Date(Date.parse(`${keys[0]}T00:00:00Z`) - 2 * 86_400_000).toISOString();

  const [ordersRes, cartsRes] = await Promise.all([
    db.from("orders").select("created_at, status").gte("created_at", sinceIso),
    db.from("cart_sessions").select("updated_at").eq("status", "active").gte("updated_at", sinceIso),
  ]);

  const dayIndex = (iso: string): number => indexByKey.get(sydneyDayKey(new Date(iso))) ?? -1;

  const paid = new Array<number>(days).fill(0);
  const pending = new Array<number>(days).fill(0);
  const carts = new Array<number>(days).fill(0);

  for (const row of ordersRes.data ?? []) {
    const i = dayIndex(row.created_at as string);
    if (i < 0) continue;
    if (row.status === "pending") pending[i] += 1;
    else if (row.status !== "cancelled") paid[i] += 1;
  }
  for (const row of cartsRes.data ?? []) {
    const i = dayIndex(row.updated_at as string);
    if (i >= 0) carts[i] += 1;
  }

  return {
    paidOrders: seriesFrom(paid),
    pendingOrders: seriesFrom(pending),
    abandonedCarts: seriesFrom(carts),
  };
}
