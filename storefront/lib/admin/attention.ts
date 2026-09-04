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
import { cache } from "react";
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

/** Outstanding "tell me when it's back" signups, per product slug. Cached for
 *  the request so the queue and the nudges share one read. */
const waitlistDemand = cache(async (): Promise<Map<string, number>> => {
  const { data } = await adminDb()
    .from("stock_notifications")
    .select("product_slug")
    .eq("notified", false);
  const demand = new Map<string, number>();
  for (const row of data ?? []) {
    const slug = row.product_slug as string;
    demand.set(slug, (demand.get(slug) ?? 0) + 1);
  }
  return demand;
});

/**
 * Vials that can actually be sold: the pack_size = 1 pool minus reservations.
 * Per-tier counts are derived and read zero while vials remain, which has
 * misled this exact screen before.
 */
function sellableVials(product: {
  variants: { pack_size: number; available: number }[];
  totalOnHand: number;
}): number {
  return product.variants.find((v) => v.pack_size === 1)?.available ?? product.totalOnHand;
}

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
    demandBySlug,
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
    waitlistDemand(),
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
      // Straight into packing mode: for an order waiting to be packed, that is
      // the screen the operator actually wants.
      href: `/admin/orders/${row.id}/pack`,
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

  // Waitlist demand only becomes work when the shelf is actually empty.
  for (const product of products) {
    const waiting = demandBySlug.get(product.slug) ?? 0;
    if (waiting === 0 || sellableVials(product) > 0) continue;
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

/* ---------------- anomaly nudges ------------------------------------------ */

export type NudgeTone = "warn" | "info";

export interface Nudge {
  id: string;
  tone: NudgeTone;
  /** The observation, stated plainly. */
  headline: string;
  /** Why it is being raised — always the comparison that made it notable. */
  detail: string;
  href: string;
}

/** Below this many prior samples there is no "usual" to compare against. */
const MIN_SAMPLES_FOR_BASELINE = 8;
/**
 * Gaps between orders are diurnal — the overnight lull is several times the
 * median by construction, so a median-based threshold fires every morning.
 * The 95th percentile already contains those overnight gaps, which makes
 * "longer than all but the quietest 5% of stretches" the honest trigger.
 */
const QUIET_PERCENTILE = 0.95;
const BOUNCE_ALERT_PCT = 5;
const UNPAID_ALERT_DAYS = 3;
/** How far back to look for a last order before declaring a dead store. */
const QUIET_LOOKBACK_DAYS = 90;

/**
 * Things worth interrupting the operator about.
 *
 * Every nudge states its own baseline, because "no orders in 36 hours" means
 * nothing without "the usual gap is 9". Anything the data cannot support a
 * baseline for is simply not raised — a nudge that cries wolf gets ignored,
 * and then the real one does too.
 */
export async function anomalyNudges(): Promise<Nudge[]> {
  const db = adminDb();
  const now = Date.now();
  const since = new Date(now - 30 * 86_400_000).toISOString();
  // Looking back further than the baseline window matters: if the store has
  // been dead for 31 days, a 30-day window is empty and the alarm that should
  // be loudest goes silent.
  const lookback = new Date(now - QUIET_LOOKBACK_DAYS * 86_400_000).toISOString();

  const [ordersRes, emailRes, unpaidRes, demandBySlug, products, sentRes] = await Promise.all([
    db
      .from("orders")
      .select("created_at")
      .in("status", ["paid", "processing", "shipped", "completed", "refunded"])
      .gte("created_at", lookback)
      .order("created_at", { ascending: true }),
    db.from("email_events").select("event").gte("occurred_at", since),
    db
      .from("orders")
      .select("id, order_number, total_cents, created_at")
      .eq("status", "pending")
      .lt("created_at", new Date(now - UNPAID_ALERT_DAYS * 86_400_000).toISOString()),
    // Both request-cached: free when the attention queue already ran.
    waitlistDemand(),
    listAllProducts(),
    // Sends, not delivery receipts, are the honest denominator for a bounce
    // rate — `delivered` only exists if that webhook happens to be subscribed.
    db
      .from("email_outbox")
      .select("*", { count: "exact", head: true })
      .eq("status", "sent")
      .gte("created_at", since),
  ]);

  const nudges: Nudge[] = [];

  // 1. An unusually long quiet spell. The baseline is this store's own median
  //    gap between paid orders, so a slow shop is not permanently alarmed.
  const stamps = (ordersRes.data ?? []).map((r) => new Date(r.created_at as string).getTime());
  const hours = (ms: number) => Math.round(ms / 3_600_000);
  const days = (ms: number) => Math.round(ms / 86_400_000);

  if (stamps.length === 0) {
    nudges.push({
      id: "quiet",
      tone: "warn",
      headline: `No paid order in over ${QUIET_LOOKBACK_DAYS} days`,
      detail:
        "Nothing has been paid for in the entire window this dashboard looks at. If that is a surprise, check the storefront and checkout first.",
      href: "/admin/orders?status=all",
    });
  } else if (stamps.length >= MIN_SAMPLES_FOR_BASELINE + 1) {
    const gaps: number[] = [];
    for (let i = 1; i < stamps.length; i++) gaps.push(stamps[i] - stamps[i - 1]);
    gaps.sort((a, b) => a - b);
    const threshold = gaps[Math.min(gaps.length - 1, Math.floor(gaps.length * QUIET_PERCENTILE))];
    const sinceLast = now - stamps[stamps.length - 1];
    if (threshold > 0 && sinceLast > threshold) {
      nudges.push({
        id: "quiet",
        tone: "warn",
        headline:
          sinceLast >= 48 * 3_600_000
            ? `No paid order in ${days(sinceLast)} days`
            : `No paid order in ${hours(sinceLast)} hours`,
        detail: `Only the quietest 5% of stretches run longer than ${hours(threshold)} hours. Worth checking the storefront and checkout still work.`,
        href: "/admin/orders?status=all",
      });
    }
  }

  // 2. Deliverability. Bounces and complaints are the two that end with a
  //    sending domain in trouble, so they are counted together.
  const events = emailRes.data ?? [];
  const bad = events.filter((e) => e.event === "bounced" || e.event === "complained").length;
  // Denominator is what was actually sent. Counting delivery receipts instead
  // reads 100% whenever the `delivered` webhook simply isn't subscribed.
  const attempted = sentRes.count ?? 0;
  if (attempted >= 20) {
    const pct = (bad / attempted) * 100;
    if (pct >= BOUNCE_ALERT_PCT) {
      nudges.push({
        id: "bounces",
        tone: "warn",
        headline: `${pct.toFixed(1)}% of email bounced or was marked spam`,
        detail: `${bad} of ${attempted} sent in the last 30 days. Above about 5% and mailbox providers start throttling the sending domain.`,
        href: "/admin/customers",
      });
    }
  }

  // 3. Money sitting in limbo. Past the reminder window these rarely convert
  //    on their own, and each one is holding reserved stock.
  const stale = unpaidRes.data ?? [];
  if (stale.length > 0) {
    const owed = stale.reduce((sum, r) => sum + ((r.total_cents as number) ?? 0), 0);
    const oldest = Math.max(...stale.map((r) => now - new Date(r.created_at as string).getTime()));
    nudges.push({
      id: "unpaid",
      tone: "warn",
      headline: `${aud(owed)} unpaid for more than ${UNPAID_ALERT_DAYS} days`,
      detail: `${stale.length} bank transfer${stale.length === 1 ? "" : "s"}, the oldest ${days(oldest)} days old. They are holding reserved stock until confirmed or cancelled.`,
      href: "/admin/orders?status=pending",
    });
  }

  // 4. Demand for things that cannot be bought. Computed here rather than by
  //    re-running attentionQueue, which would repeat four order and review
  //    queries the dashboard has already made in a sibling section.
  const starved = products
    .map((product) => ({ product, waiting: demandBySlug.get(product.slug) ?? 0 }))
    .filter(({ product, waiting }) => waiting > 0 && sellableVials(product) <= 0)
    .sort((a, b) => b.waiting - a.waiting);
  if (starved.length > 0) {
    const waiting = starved.reduce((sum, entry) => sum + entry.waiting, 0);
    nudges.push({
      id: "demand",
      tone: "info",
      headline: `${waiting} people waiting on ${starved.length} out-of-stock product${starved.length === 1 ? "" : "s"}`,
      detail: `Led by ${starved[0].product.name}. Each of them asked to be told when it is back.`,
      href: "/admin/pipeline",
    });
  }

  return nudges;
}
