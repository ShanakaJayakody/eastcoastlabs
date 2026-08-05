import "server-only";

/**
 * Marketing lifecycle sweeps — the Resend-native replacement for a Klaviyo flow
 * engine. Same architecture as payment-ops: idempotent cron sweeps over
 * existing tables, with email_outbox's (to_email, template, related_id) unique
 * index as the send-exactly-once guarantee. No scheduling column, no state
 * machine — a stage is due when its source row's age crosses the threshold and
 * the outbox has no row for that stage yet.
 *
 * Two invariants every sweep upholds:
 *   * Suppression: an email with unsubscribed_at set on ANY subscribers row
 *     never receives marketing. Checked batch-wise before queuing.
 *   * Eligibility windows: each stage has an upper bound as well as a lower
 *     one, so the first deploy (or a cron outage) can never blast stale
 *     audiences with months-old "your order shipped 2 days ago" emails.
 *
 * If no unsubscribe secret is configured, sweeps send nothing (Spam Act
 * requires a functional unsubscribe on marketing mail).
 */

import { adminDb } from "./db";
import { queueEmail, type EmailTemplate } from "./email";
import { unsubscribeUrl } from "@/lib/email/unsubscribe";

const SITE = "https://eastcoastlabs.com.au";
const DAY_MS = 86_400_000;

const daysSince = (iso: string) => (Date.now() - new Date(iso).getTime()) / DAY_MS;
const isoDaysAgo = (days: number) => new Date(Date.now() - days * DAY_MS).toISOString();

/** Emails with unsubscribed_at set on any subscribers row. */
async function suppressedEmails(emails: string[]): Promise<Set<string>> {
  const unique = [...new Set(emails)];
  if (!unique.length) return new Set();
  const { data } = await adminDb()
    .from("subscribers")
    .select("email")
    .in("email", unique)
    .not("unsubscribed_at", "is", null);
  return new Set((data ?? []).map((r) => (r as { email: string }).email));
}

interface MarketingSend {
  to: string;
  template: EmailTemplate;
  payload?: Record<string, unknown>;
  relatedType: string;
  relatedId: string;
}

/** Queue marketing sends, applying suppression + unsubscribe-link injection. */
async function queueMarketing(sends: MarketingSend[]): Promise<number> {
  if (!sends.length) return 0;
  const suppressed = await suppressedEmails(sends.map((s) => s.to));
  let queued = 0;
  for (const send of sends) {
    if (suppressed.has(send.to)) continue;
    const unsub = unsubscribeUrl(send.to);
    if (!unsub) {
      console.error("lifecycle: no UNSUBSCRIBE_SECRET/CRON_SECRET configured — marketing sends skipped");
      return queued;
    }
    await queueEmail({
      to: send.to,
      template: send.template,
      payload: { ...(send.payload ?? {}), unsubscribe_url: unsub },
      relatedType: send.relatedType,
      relatedId: send.relatedId,
    });
    queued++;
  }
  return queued;
}

/**
 * Welcome series stages 2 and 3 (stage 1 is queued directly by /api/subscribe).
 * A subscriber leaves the series the moment they place any order — the series'
 * job is the first purchase.
 */
export async function sweepWelcomeSeries(): Promise<{ queued: number }> {
  const db = adminDb();
  const { data } = await db
    .from("subscribers")
    .select("email, source, created_at")
    .is("unsubscribed_at", null)
    .gte("created_at", isoDaysAgo(18))
    .order("created_at", { ascending: true })
    .limit(500);

  const bySubscriber = new Map<string, string>();
  for (const row of (data ?? []) as { email: string; source: string | null; created_at: string }[]) {
    const source = row.source ?? "";
    if (source.startsWith("back_in_stock:") || source === "unsubscribe") continue;
    if (!bySubscriber.has(row.email)) bySubscriber.set(row.email, row.created_at);
  }
  if (!bySubscriber.size) return { queued: 0 };

  const { data: orderRows } = await db
    .from("orders")
    .select("customer_email")
    .in("customer_email", [...bySubscriber.keys()]);
  const purchased = new Set((orderRows ?? []).map((r) => (r as { customer_email: string }).customer_email));

  const stages: { days: number; n: 2 | 3; template: EmailTemplate }[] = [
    { days: 2, n: 2, template: "welcome_2" },
    { days: 4, n: 3, template: "welcome_3" },
  ];

  const sends: MarketingSend[] = [];
  for (const [email, createdAt] of bySubscriber) {
    if (purchased.has(email)) continue;
    const age = daysSince(createdAt);
    for (const stage of stages) {
      if (age >= stage.days && age < stage.days + 14) {
        sends.push({
          to: email,
          template: stage.template,
          relatedType: "subscriber",
          relatedId: `${email}:welcome:${stage.n}`,
        });
      }
    }
  }
  return { queued: await queueMarketing(sends) };
}

interface FulfilledOrderRow {
  id: string;
  order_number: string;
  customer_email: string;
  created_at: string;
  shipped_at: string;
}

/** Post-purchase: COA walkthrough at shipped+2d, review request at shipped+14d. */
export async function sweepPostPurchase(): Promise<{ queued: number }> {
  const db = adminDb();
  const { data } = await db
    .from("orders")
    .select("id, order_number, customer_email, created_at, shipped_at")
    .in("status", ["shipped", "completed"])
    .not("shipped_at", "is", null)
    .gte("shipped_at", isoDaysAgo(45))
    .limit(500);
  const orders = (data ?? []) as FulfilledOrderRow[];
  if (!orders.length) return { queued: 0 };

  const { data: reviewRows } = await db
    .from("reviews")
    .select("order_id")
    .in("order_id", orders.map((o) => o.id));
  const reviewed = new Set((reviewRows ?? []).map((r) => (r as { order_id: string }).order_id));

  const sends: MarketingSend[] = [];
  for (const order of orders) {
    const age = daysSince(order.shipped_at);
    if (age >= 2 && age < 14) {
      sends.push({
        to: order.customer_email,
        template: "post_purchase_coa",
        payload: { order_number: order.order_number },
        relatedType: "order",
        relatedId: `${order.id}:pp:coa`,
      });
    }
    if (age >= 14 && age < 35 && !reviewed.has(order.id)) {
      const reviewUrl = `${SITE}/leave-a-review?order=${encodeURIComponent(order.order_number)}&email=${encodeURIComponent(order.customer_email)}`;
      sends.push({
        to: order.customer_email,
        template: "post_purchase_review",
        payload: { order_number: order.order_number, review_url: reviewUrl },
        relatedType: "order",
        relatedId: `${order.id}:pp:review`,
      });
    }
  }
  return { queued: await queueMarketing(sends) };
}

interface ReplenishmentOrderRow extends FulfilledOrderRow {
  order_items: {
    product_name: string;
    qty: number;
    variant_label: string;
    product_variants: { pack_size: number } | null;
  }[];
}

const packSizeFromLabel = (label: string): number => {
  const m = /(\d+)\s*-?\s*pack/i.exec(label);
  return m ? parseInt(m[1], 10) : 1;
};

/** Replenishment thresholds in days, by largest pack size in the order. */
const replenishmentDays = (packSize: number) => (packSize >= 6 ? 154 : packSize >= 3 ? 70 : 21);

/**
 * Replenishment: nudge each customer's LATEST fulfilled order once its
 * pack-size-scaled consumption window has passed — unless they've ordered
 * again since.
 */
export async function sweepReplenishment(): Promise<{ queued: number }> {
  const db = adminDb();
  const { data } = await db
    .from("orders")
    .select(
      "id, order_number, customer_email, created_at, shipped_at, order_items(product_name, qty, variant_label, product_variants(pack_size))",
    )
    .in("status", ["shipped", "completed"])
    .not("shipped_at", "is", null)
    .gte("shipped_at", isoDaysAgo(200))
    .limit(500);
  const orders = (data ?? []) as unknown as ReplenishmentOrderRow[];
  if (!orders.length) return { queued: 0 };

  // Latest fulfilled order per customer.
  const latestByEmail = new Map<string, ReplenishmentOrderRow>();
  for (const order of orders) {
    const prev = latestByEmail.get(order.customer_email);
    if (!prev || order.created_at > prev.created_at) latestByEmail.set(order.customer_email, order);
  }

  // "Reordered since" includes pending/unpaid orders — any newer order means
  // the customer doesn't need a restock nudge.
  const { data: allOrders } = await db
    .from("orders")
    .select("customer_email, created_at")
    .in("customer_email", [...latestByEmail.keys()])
    .neq("status", "cancelled");
  const newestByEmail = new Map<string, string>();
  for (const row of (allOrders ?? []) as { customer_email: string; created_at: string }[]) {
    const prev = newestByEmail.get(row.customer_email);
    if (!prev || row.created_at > prev) newestByEmail.set(row.customer_email, row.created_at);
  }

  const sends: MarketingSend[] = [];
  for (const [email, order] of latestByEmail) {
    const newest = newestByEmail.get(email);
    if (newest && newest > order.created_at) continue;

    const packSize = Math.max(
      1,
      ...order.order_items.map((i) => i.product_variants?.pack_size ?? packSizeFromLabel(i.variant_label ?? "")),
    );
    const dueDays = replenishmentDays(packSize);
    const age = daysSince(order.shipped_at);
    if (age < dueDays || age >= dueDays + 42) continue;

    sends.push({
      to: email,
      template: "replenishment",
      payload: {
        pack_size: packSize,
        items: order.order_items.map((i) => ({ name: i.product_name, qty: i.qty })),
      },
      relatedType: "order",
      relatedId: `${order.id}:replenishment`,
    });
  }
  return { queued: await queueMarketing(sends) };
}

interface CustomerRow {
  email: string;
  orders_count: number;
  last_order_at: string;
}

/** Winback: 60d and 90d inactivity touches, each sent at most once per lapse. */
export async function sweepWinback(): Promise<{ queued: number }> {
  const db = adminDb();
  const { data } = await db
    .from("customers")
    .select("email, orders_count, last_order_at")
    .gte("last_order_at", isoDaysAgo(150))
    .lte("last_order_at", isoDaysAgo(60))
    .limit(500);
  const customers = (data ?? []) as CustomerRow[];

  const sends: MarketingSend[] = [];
  for (const customer of customers) {
    const age = daysSince(customer.last_order_at);
    if (age >= 60 && age < 90) {
      sends.push({
        to: customer.email,
        template: "winback_60",
        relatedType: "customer",
        relatedId: `${customer.email}:winback:60:${customer.last_order_at.slice(0, 10)}`,
      });
    } else if (age >= 90 && age < 150) {
      sends.push({
        to: customer.email,
        template: "winback_90",
        relatedType: "customer",
        relatedId: `${customer.email}:winback:90:${customer.last_order_at.slice(0, 10)}`,
      });
    }
  }
  return { queued: await queueMarketing(sends) };
}

/**
 * Day-30 second-purchase nudge — the 1st→2nd order conversion. Skips anyone
 * who got a replenishment email recently (a 1-vial buyer's replenishment lands
 * at day 21; stacking a near-identical nudge 9 days later reads as spam).
 */
export async function sweepSecondPurchaseNudge(): Promise<{ queued: number }> {
  const db = adminDb();
  const { data } = await db
    .from("customers")
    .select("email, orders_count, last_order_at")
    .eq("orders_count", 1)
    .gte("last_order_at", isoDaysAgo(60))
    .lte("last_order_at", isoDaysAgo(30))
    .limit(500);
  const customers = (data ?? []) as CustomerRow[];
  if (!customers.length) return { queued: 0 };

  const { data: recentReplenishment } = await db
    .from("email_outbox")
    .select("to_email")
    .eq("template", "replenishment")
    .in("to_email", customers.map((c) => c.email))
    .gte("created_at", isoDaysAgo(30));
  const recentlyNudged = new Set(
    (recentReplenishment ?? []).map((r) => (r as { to_email: string }).to_email),
  );

  const sends: MarketingSend[] = customers
    .filter((c) => !recentlyNudged.has(c.email))
    .map((c) => ({
      to: c.email,
      template: "second_purchase_nudge",
      relatedType: "customer",
      relatedId: `${c.email}:nudge:30:${c.last_order_at.slice(0, 10)}`,
    }));
  return { queued: await queueMarketing(sends) };
}
