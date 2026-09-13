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

import { fetchAll } from "./paging";
import { economicLines } from "./costs";
import { summarizeLines, contribution, customerCohorts, matureCreatedToPaid, type EconomicLine, type VariableCosts, type CustomerEconomicOrder } from "./economics";

/** Legacy paid statuses used only to expose missing payment timestamps. */
const SOLD = ["paid", "processing", "shipped", "completed", "refunded"];

export interface ProductPerformanceRow {
  slug: string;
  name: string;
  unitsSold: number;
  revenueCents: number;
  cogsCents: number;
  profitCents: number | null;
  marginPct: number | null;
  refundedCents: number;
  refundedUnits: number;
  /** Sold lines with no cost snapshot — profit for this row is unknown. */
  uncostedLines: number;
  /** People on the restock waitlist right now, whatever the window. */
  waiting: number;
  onHand: number;
}

export interface ProductPerformance {
  rows: ProductPerformanceRow[];
  totals: { unitsSold: number; revenueCents: number; profitCents: number | null; uncostedLines: number; missingOrders: number };
}

/**
 * What sold in the window, by product.
 *
 * Line revenue, not order totals — shipping is excluded; allocated discounts and merchandise refunds are deducted.
 * This is the paid-order cohort as known now, not a refund-date cash ledger.
 */
export async function productPerformance(meta: WindowMeta): Promise<ProductPerformance> {
  const db = adminDb();

  const [orders, products] = await Promise.all([
    fetchAll<{ id: string; status: string }>(
      (from, to) =>
        db
          .from("orders")
          .select("id, status")
          .not("paid_at", "is", null)
          .gte("paid_at", meta.startIso)
          .lt("paid_at", meta.endIso)
          .order("id", { ascending: true })
          .range(from, to),
      "productPerformance orders",
    ),
    listAllProducts(),
  ]);

  const orderIds = orders.map((r) => r.id);
  const representedOrders=new Set<string>();
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
      const data = await economicLines(slice) as (EconomicLine & {product_slug:string|null;product_name:string|null})[];

      for (const line of data) {
        representedOrders.add(line.order_id);
        const slug = (line.product_slug as string) ?? "unknown";
        const row = seed(slug, (line.product_name as string) ?? slug);
        const qty = line.qty;
        const whole = fullyRefunded.has(line.order_id);
        const refundedQty = whole ? qty : (line.refunded_qty ?? 0);
        const normalized={...line,refunded_cents:whole?line.line_total_cents-line.discount_allocated_cents:line.refunded_cents};
        const summary=summarizeLines([normalized]);
        row.unitsSold += Math.max(0,qty-refundedQty);
        row.refundedUnits += refundedQty;
        row.refundedCents += normalized.refunded_cents??0;
        row.revenueCents += summary.revenueCents;
        row.cogsCents += summary.cogsCents;
        row.uncostedLines += summary.uncostedLines;
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
        .order("id", { ascending: true })
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
      profitCents: row.uncostedLines ? null : row.revenueCents - row.cogsCents,
      marginPct:
        row.uncostedLines === 0 && row.revenueCents > 0
          ? Math.round(((row.revenueCents - row.cogsCents) / row.revenueCents) * 1000) / 10
          : null,
    }))
    .sort((a, b) => b.revenueCents - a.revenueCents || a.name.localeCompare(b.name));

  return {
    rows,
    totals: {
      missingOrders:orderIds.length-representedOrders.size,
      unitsSold: rows.reduce((s, r) => s + r.unitsSold, 0),
      revenueCents: rows.reduce((s, r) => s + r.revenueCents, 0),
      profitCents: representedOrders.size<orderIds.length||rows.some(r=>r.profitCents==null)?null:rows.reduce((s, r) => s + (r.profitCents??0), 0),
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
    fetchAll<{ status: string; paid_at:string|null; shipped_at: string | null }>(
      (from, to) =>
        db
          .from("orders")
          .select("status, paid_at, shipped_at")
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
  if(awaitingRes.error)throw new Error(`Awaiting dispatch: ${awaitingRes.error.message}`);
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
    ordersPaid: orders.filter((o) => o.paid_at != null).length,
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
        .order("id", { ascending: true })
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
    } else if (row.status === "failed" || row.status === "dead") {
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

export async function variableCosts(orderIds:string[]) {
  const result=new Map<string,VariableCosts>();
  for(let i=0;i<orderIds.length;i+=200) {
    const rows=await fetchAll<VariableCosts & {order_id:string}>((from,to)=>adminDb().from("order_variable_costs").select("*").in("order_id",orderIds.slice(i,i+200)).order("order_id",{ascending:true}).range(from,to),"Variable order costs");
    for(const row of rows)result.set(row.order_id,row);
  }
  return result;
}
async function withContribution(orders:CustomerEconomicOrder[]) {
  const paid=orders.filter(o=>o.paid_at!=null);
  const ids=paid.map(o=>o.id);
  const [lines,costs]=await Promise.all([economicLines(ids),variableCosts(ids)]);
  const byOrder=new Map<string,EconomicLine[]>();
  for(const line of lines){const group=byOrder.get(line.order_id)??[];group.push(line);byOrder.set(line.order_id,group);}
  return paid.map(order=>{
    const items=byOrder.get(order.id)??[];
    const profit=summarizeLines(items);
    if(!items.length){profit.profitCents=null;profit.uncostedLines=1;}
    const value=contribution(order.total_cents-(order.refunded_cents??0),profit,costs.get(order.id)??null);
    return {...order,profit,...value,contributionCents:value.afterAcquisitionCents};
  });
}
export async function contributionReport(meta:WindowMeta,now=new Date()) {
  const db=adminDb();
  const select="id, customer_email, total_cents, refunded_cents, created_at, paid_at";
  const [paid,created,legacy]=await Promise.all([
    fetchAll<CustomerEconomicOrder>((from,to)=>db.from("orders").select(select).gte("paid_at",meta.startIso).lt("paid_at",meta.endIso).order("id",{ascending:true}).range(from,to),"Contribution orders"),
    fetchAll<CustomerEconomicOrder>((from,to)=>db.from("orders").select(select).gte("created_at",meta.startIso).lt("created_at",meta.endIso).order("id",{ascending:true}).range(from,to),"Created-order cohort"),
    db.from("orders").select("id",{count:"exact",head:true}).in("status",SOLD).is("paid_at",null),
  ]);
  if(legacy.error)throw new Error(`Legacy payment coverage: ${legacy.error.message}`);
  const orders=await withContribution(paid);
  const sumKnown=(values:(number|null)[])=>values.some(v=>v==null)?null:values.reduce<number>((sum,v)=>sum+(v??0),0);
  return {orders:orders.length,netRevenueCents:orders.reduce((sum,o)=>sum+o.total_cents-(o.refunded_cents??0),0),
    grossProfitCents:sumKnown(orders.map(o=>o.profit.profitCents)),
    beforeAcquisitionCents:sumKnown(orders.map(o=>o.beforeAcquisitionCents)),afterAcquisitionCents:sumKnown(orders.map(o=>o.afterAcquisitionCents)),
    costedOrders:orders.filter(o=>o.profit.profitCents!=null).length,
    contributionCoveredOrders:orders.filter(o=>o.afterAcquisitionCents!=null).length,
    missingPaidDates:legacy.count??0,conversion:matureCreatedToPaid(created,now),
    incompleteOrders:orders.filter(o=>o.afterAcquisitionCents==null).map(o=>o.id)};
}
export async function cohorts(now=new Date()) {
  const orders=await fetchAll<CustomerEconomicOrder>((from,to)=>adminDb().from("orders").select("id,customer_email,total_cents,refunded_cents,created_at,paid_at").not("paid_at","is",null).order("id",{ascending:true}).range(from,to),"Cohorts");
  return customerCohorts(await withContribution(orders),now);
}
export type CohortRow=Awaited<ReturnType<typeof cohorts>>[number];
