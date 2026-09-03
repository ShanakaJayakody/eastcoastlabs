/**
 * The reports area.
 *
 * These are the questions that do not belong on a dashboard: what actually
 * sells, where orders fall out of the funnel, whether email is landing, and
 * whether customers come back. Each is expensive enough that putting it on the
 * daily surface would slow down the screen an operator opens twenty times a day.
 *
 * Every window-scoped report takes a `WindowMeta` rather than raw dates, so the
 * period stepper on the reports page and the one on the revenue chart cannot
 * drift apart in what "September" means.
 */
import "server-only";
import { adminDb } from "./db";
import { listAllProducts } from "./products";
import type { WindowMeta } from "./order-queries";
import type { OrderStatus } from "./orders";

/** The statuses that count as a sale. Matches revenueWindow exactly. */
const SOLD: OrderStatus[] = ["paid", "processing", "shipped", "completed", "refunded"];

/**
 * PostgREST caps an unbounded response at the project's max-rows setting
 * (1000 by default) and says nothing about it. A report that quietly drops the
 * 1001st order is worse than one that refuses to load, so every full-table read
 * here pages explicitly.
 *
 * Callers must order by a UNIQUE column. Offset paging over a non-unique sort
 * lets a tie straddling a page boundary appear on both pages, which shows up as
 * a product having sold more than it did.
 */
const PAGE = 500;
const MAX_ROWS = 50_000;

async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  label: string,
): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE) {
    const { data, error } = await build(offset, offset + PAGE - 1);
    if (error) throw new Error(`${label}: ${error.message}`);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

export interface ProductPerformanceRow {
  slug: string;
  name: string;
  unitsSold: number;
  revenueCents: number;
  cogsCents: number;
  profitCents: number;
  marginPct: number | null;
  refundedCents: number;
  refundedUnits: number;
  /** Sold lines with no cost snapshot — profit for this row is overstated. */
  uncostedLines: number;
  /** People on the restock waitlist right now, whatever the window. */
  waiting: number;
  onHand: number;
}

export interface ProductPerformance {
  rows: ProductPerformanceRow[];
  totals: { unitsSold: number; revenueCents: number; profitCents: number; uncostedLines: number };
}

/**
 * What sold in the window, by product.
 *
 * Line revenue, not order totals — shipping and order-level discounts cannot be
 * attributed to a product without inventing an allocation rule, so they are
 * simply absent here. That makes this table's revenue slightly lower than the
 * dashboard's, and the page says so.
 */
export async function productPerformance(meta: WindowMeta): Promise<ProductPerformance> {
  const db = adminDb();

  const [orders, products] = await Promise.all([
    fetchAll<{ id: string; status: string }>(
      (from, to) =>
        db
          .from("orders")
          .select("id, status")
          .in("status", SOLD)
          .gte("created_at", meta.startIso)
          .lt("created_at", meta.endIso)
          .order("id", { ascending: true })
          .range(from, to),
      "productPerformance orders",
    ),
    listAllProducts(),
  ]);

  const orderIds = orders.map((r) => r.id);
  // Whole-order refunds now mark their lines, but rows refunded before that fix
  // still read as full-price sales. Trusting the order's status keeps the
  // products report agreeing with the dashboard on historical data too.
  const fullyRefunded = new Set(orders.filter((o) => o.status === "refunded").map((o) => o.id));
  const bySlug = new Map<string, ProductPerformanceRow>();

  const seed = (slug: string, name: string): ProductPerformanceRow => {
    const existing = bySlug.get(slug);
    if (existing) return existing;
    const row: ProductPerformanceRow = {
      slug,
      name,
      unitsSold: 0,
      revenueCents: 0,
      cogsCents: 0,
      profitCents: 0,
      marginPct: null,
      refundedCents: 0,
      refundedUnits: 0,
      uncostedLines: 0,
      waiting: 0,
      onHand: 0,
    };
    bySlug.set(slug, row);
    return row;
  };

  if (orderIds.length) {
    // Chunked: every id goes into the PostgREST query string, and a busy month
    // would otherwise build a URL long enough to be rejected.
    const CHUNK = 200;
    for (let i = 0; i < orderIds.length; i += CHUNK) {
      const slice = orderIds.slice(i, i + CHUNK);
      // Paged as well as chunked: 200 orders can easily carry more than the
      // 1000 lines PostgREST will return in one response.
      const data = await fetchAll<{
        order_id: string;
        product_slug: string | null;
        product_name: string | null;
        qty: number;
        refunded_qty: number | null;
        line_total_cents: number;
        refunded_cents: number | null;
        unit_cost_cents: number | null;
      }>(
        (from, to) =>
          db
            .from("order_items")
            .select(
              "order_id, product_slug, product_name, qty, refunded_qty, line_total_cents, refunded_cents, unit_cost_cents",
            )
            .in("order_id", slice)
            .order("id", { ascending: true })
            .range(from, to),
        "productPerformance lines",
      );

      for (const line of data) {
        const slug = (line.product_slug as string) ?? "unknown";
        const row = seed(slug, (line.product_name as string) ?? slug);
        const qty = (line.qty as number) ?? 0;
        const whole = fullyRefunded.has(line.order_id);
        const refundedQty = whole ? qty : ((line.refunded_qty as number) ?? 0);
        const netQty = Math.max(0, qty - refundedQty);
        const refunded = whole
          ? (line.line_total_cents as number)
          : ((line.refunded_cents as number) ?? 0);

        row.unitsSold += netQty;
        row.refundedUnits += refundedQty;
        row.refundedCents += refunded;
        row.revenueCents += ((line.line_total_cents as number) ?? 0) - refunded;

        if (line.unit_cost_cents == null) {
          if (netQty > 0) row.uncostedLines += 1;
        } else {
          row.cogsCents += (line.unit_cost_cents as number) * netQty;
        }
      }
    }
  }

  // Waitlist and stock come from the catalogue, which is request-cached.
  const waitlist = await fetchAll<{ product_slug: string }>(
    (from, to) =>
      db
        .from("stock_notifications")
        .select("product_slug")
        .eq("notified", false)
        .order("created_at", { ascending: true })
        .range(from, to),
    "productPerformance waitlist",
  );
  const waiting = new Map<string, number>();
  for (const row of waitlist) {
    const slug = row.product_slug;
    waiting.set(slug, (waiting.get(slug) ?? 0) + 1);
  }

  for (const product of products) {
    const row = seed(product.slug, product.name);
    row.name = product.name;
    row.waiting = waiting.get(product.slug) ?? 0;
    row.onHand =
      product.variants.find((v) => v.pack_size === 1)?.available ?? product.totalOnHand;
  }

  const rows = [...bySlug.values()]
    .map((row) => ({
      ...row,
      profitCents: row.revenueCents - row.cogsCents,
      marginPct:
        row.revenueCents > 0
          ? Math.round(((row.revenueCents - row.cogsCents) / row.revenueCents) * 1000) / 10
          : null,
    }))
    .sort((a, b) => b.revenueCents - a.revenueCents || a.name.localeCompare(b.name));

  return {
    rows,
    totals: {
      unitsSold: rows.reduce((s, r) => s + r.unitsSold, 0),
      revenueCents: rows.reduce((s, r) => s + r.revenueCents, 0),
      profitCents: rows.reduce((s, r) => s + r.profitCents, 0),
      uncostedLines: rows.reduce((s, r) => s + r.uncostedLines, 0),
    },
  };
}

export interface FulfilmentFunnel {
  /**
   * Checkout email addresses first captured in this window. NOT a cart count
   * and NOT a funnel denominator: `cart_sessions` is keyed uniquely on email and
   * upserted without refreshing `created_at`, so a returning shopper is counted
   * in the month they first appeared, and anyone who never types an email is
   * never counted at all.
   */
  newCheckoutEmails: number;
  cartsRecovered: number;
  ordersRaised: number;
  ordersPaid: number;
  ordersShipped: number;
  ordersCancelled: number;
  ordersRefunded: number;
  /** Median hours from payment to dispatch, over orders shipped in the window. */
  medianShipHours: number | null;
  slowestShipHours: number | null;
  /** Paid orders still unshipped right now, regardless of window. */
  awaitingDispatch: number;
}

/**
 * Where orders come from and where they stop.
 *
 * Time-to-ship is measured from payment, not from order creation: a bank
 * transfer that sat unpaid for three days was not three days late to pack, and
 * counting it that way makes the store look slower than it is.
 */
export async function fulfilmentFunnel(meta: WindowMeta): Promise<FulfilmentFunnel> {
  const db = adminDb();

  const [carts, orders, shipped, awaitingRes] = await Promise.all([
    fetchAll<{ status: string }>(
      (from, to) =>
        db
          .from("cart_sessions")
          .select("status")
          .gte("created_at", meta.startIso)
          .lt("created_at", meta.endIso)
          .order("email", { ascending: true })
          .range(from, to),
      "fulfilmentFunnel carts",
    ),
    fetchAll<{ status: string; shipped_at: string | null }>(
      (from, to) =>
        db
          .from("orders")
          .select("status, shipped_at")
          .gte("created_at", meta.startIso)
          .lt("created_at", meta.endIso)
          .order("id", { ascending: true })
          .range(from, to),
      "fulfilmentFunnel orders",
    ),
    // Shipped *in* the window, whenever the order was raised — the question is
    // how fast the operator moved this week, not which cohort the orders came from.
    fetchAll<{ paid_at: string | null; shipped_at: string | null }>(
      (from, to) =>
        db
          .from("orders")
          .select("paid_at, shipped_at")
          .not("shipped_at", "is", null)
          .gte("shipped_at", meta.startIso)
          .lt("shipped_at", meta.endIso)
          .order("id", { ascending: true })
          .range(from, to),
      "fulfilmentFunnel shipped",
    ),
    db.from("orders").select("*", { count: "exact", head: true }).in("status", ["paid", "processing"]),
  ]);
  const countBy = (status: string) => orders.filter((o) => o.status === status).length;

  const gaps: number[] = [];
  for (const row of shipped) {
    if (!row.paid_at || !row.shipped_at) continue;
    const hours =
      (new Date(row.shipped_at as string).getTime() - new Date(row.paid_at as string).getTime()) /
      3_600_000;
    if (hours >= 0) gaps.push(hours);
  }
  gaps.sort((a, b) => a - b);

  return {
    newCheckoutEmails: carts.length,
    cartsRecovered: carts.filter((c) => c.status === "recovered").length,
    ordersRaised: orders.length,
    ordersPaid: orders.filter((o) => SOLD.includes(o.status as OrderStatus)).length,
    // Counted by shipped_at, not by current status: an order that shipped and
    // was later refunded still shipped, and judging dispatch performance by a
    // status the order has since left understates it by exactly the refunds.
    ordersShipped: orders.filter((o) => o.shipped_at != null).length,
    ordersCancelled: countBy("cancelled"),
    ordersRefunded: countBy("refunded"),
    medianShipHours: gaps.length ? Math.round(gaps[Math.floor(gaps.length / 2)] * 10) / 10 : null,
    slowestShipHours: gaps.length ? Math.round(gaps[gaps.length - 1] * 10) / 10 : null,
    awaitingDispatch: awaitingRes.count ?? 0,
  };
}

export interface EmailTemplateRow {
  template: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  failed: number;
}

export interface EmailPerformance {
  rows: EmailTemplateRow[];
  totals: EmailTemplateRow;
  /** True when no delivery receipts exist at all — the webhook may be off. */
  deliveryTrackingMissing: boolean;
  /** True when nothing has ever been recorded as opened or clicked. */
  engagementTrackingMissing: boolean;
}

/**
 * Per-template send and engagement.
 *
 * Rates are computed against *sends*, not against delivery receipts. Resend
 * only writes a `delivered` event if that webhook is subscribed, and dividing
 * by it would report 0% or 100% for a mailbox that is working perfectly well.
 */
export async function emailPerformance(meta: WindowMeta): Promise<EmailPerformance> {
  const db = adminDb();

  const outbox = await fetchAll<{ id: string; template: string; status: string }>(
    (from, to) =>
      db
        .from("email_outbox")
        .select("id, template, status")
        .gte("created_at", meta.startIso)
        .lt("created_at", meta.endIso)
        .order("created_at", { ascending: true })
        .range(from, to),
    "emailPerformance",
  );

  const templateOf = new Map<string, string>();
  const byTemplate = new Map<string, EmailTemplateRow>();
  const seed = (template: string): EmailTemplateRow => {
    const existing = byTemplate.get(template);
    if (existing) return existing;
    const row: EmailTemplateRow = {
      template,
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      bounced: 0,
      complained: 0,
      failed: 0,
    };
    byTemplate.set(template, row);
    return row;
  };

  const sentIds: string[] = [];
  for (const row of outbox) {
    const template = row.template as string;
    const entry = seed(template);
    if (row.status === "sent") {
      entry.sent += 1;
      sentIds.push(row.id as string);
      templateOf.set(row.id as string, template);
    } else if (row.status === "failed") {
      entry.failed += 1;
    }
  }

  // Engagement events can arrive days after the send, so they are matched by
  // outbox id rather than by their own timestamp falling inside the window.
  if (sentIds.length) {
    const CHUNK = 200;
    for (let i = 0; i < sentIds.length; i += CHUNK) {
      const slice = sentIds.slice(i, i + CHUNK);
      // Paged and throwing. Swallowing an error here produced zero engagement
      // events, which the page then explained to the operator as "your webhook
      // is not subscribed" — a confident, actionable, wrong diagnosis.
      const events = await fetchAll<{ outbox_id: string; event: string }>(
        (from, to) =>
          db
            .from("email_events")
            .select("outbox_id, event")
            .in("outbox_id", slice)
            .order("id", { ascending: true })
            .range(from, to),
        "emailPerformance events",
      );
      for (const event of events) {
        const template = templateOf.get(event.outbox_id as string);
        if (!template) continue;
        const entry = seed(template);
        const kind = event.event as string;
        if (kind === "delivered") entry.delivered += 1;
        else if (kind === "opened") entry.opened += 1;
        else if (kind === "clicked") entry.clicked += 1;
        else if (kind === "bounced") entry.bounced += 1;
        else if (kind === "complained") entry.complained += 1;
      }
    }
  }

  const rows = [...byTemplate.values()].sort((a, b) => b.sent - a.sent || a.template.localeCompare(b.template));
  const totals = rows.reduce<EmailTemplateRow>(
    (acc, row) => ({
      template: "All templates",
      sent: acc.sent + row.sent,
      delivered: acc.delivered + row.delivered,
      opened: acc.opened + row.opened,
      clicked: acc.clicked + row.clicked,
      bounced: acc.bounced + row.bounced,
      complained: acc.complained + row.complained,
      failed: acc.failed + row.failed,
    }),
    { template: "All templates", sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, complained: 0, failed: 0 },
  );

  return {
    rows,
    totals,
    // Distinguishing these two matters: "nobody opened it" and "nobody is
    // recording opens" look identical in the numbers and need opposite actions.
    deliveryTrackingMissing: totals.sent > 0 && totals.delivered === 0,
    engagementTrackingMissing: totals.sent > 0 && totals.opened === 0 && totals.clicked === 0,
  };
}

export interface CohortRow {
  /** First-order month, `YYYY-MM`. */
  month: string;
  customers: number;
  repeatCustomers: number;
  repeatPct: number;
  totalLtvCents: number;
  averageLtvCents: number;
}

/**
 * Customers grouped by the month of their first *paid* order.
 *
 * Built from orders rather than the `customers` view on purpose. That view
 * dates a customer by their earliest order of any kind and counts unpaid ones,
 * so a shopper whose only order was cancelled would appear as a customer with
 * no lifetime value, and someone with one abandoned bank transfer plus one real
 * purchase would be filed under the wrong month and counted as a repeat buyer.
 *
 * Not window-scoped: a cohort is defined by when people arrived, and the
 * interesting number — how many came back — only becomes visible with time.
 * The most recent month always looks worst and always will.
 */
export async function cohorts(): Promise<CohortRow[]> {
  const db = adminDb();
  const data = await fetchAll<{
    id: string;
    customer_email: string;
    total_cents: number;
    refunded_cents: number | null;
    created_at: string;
  }>(
    (from, to) =>
      db
        .from("orders")
        .select("id, customer_email, total_cents, refunded_cents, created_at")
        .in("status", SOLD)
        .order("id", { ascending: true })
        .range(from, to),
    "cohorts",
  );

  const monthKey = (iso: string): string =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Australia/Sydney",
      year: "numeric",
      month: "2-digit",
    }).format(new Date(iso));

  // Fold orders into one record per person first: first paid order, how many
  // paid orders, and net spend.
  const people = new Map<string, { first: string; orders: number; netCents: number }>();
  for (const row of data) {
    const email = (row.customer_email ?? "").trim().toLowerCase();
    if (!email) continue;
    const net = (row.total_cents ?? 0) - (row.refunded_cents ?? 0);
    const existing = people.get(email);
    if (existing) {
      existing.orders += 1;
      existing.netCents += net;
      if (row.created_at < existing.first) existing.first = row.created_at;
    } else {
      people.set(email, { first: row.created_at, orders: 1, netCents: net });
    }
  }

  const byMonth = new Map<string, CohortRow>();
  for (const person of people.values()) {
    const month = monthKey(person.first);
    const entry = byMonth.get(month) ?? {
      month,
      customers: 0,
      repeatCustomers: 0,
      repeatPct: 0,
      totalLtvCents: 0,
      averageLtvCents: 0,
    };
    entry.customers += 1;
    if (person.orders > 1) entry.repeatCustomers += 1;
    entry.totalLtvCents += person.netCents;
    byMonth.set(month, entry);
  }

  return [...byMonth.values()]
    .map((row) => ({
      ...row,
      repeatPct: row.customers > 0 ? Math.round((row.repeatCustomers / row.customers) * 1000) / 10 : 0,
      averageLtvCents: row.customers > 0 ? Math.round(row.totalLtvCents / row.customers) : 0,
    }))
    .sort((a, b) => b.month.localeCompare(a.month));
}
