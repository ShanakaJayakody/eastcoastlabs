import "server-only";
import { createOrderAccessToken } from "@/lib/order-access";

/**
 * Marketing lifecycle sweeps — the Resend-native replacement for a Klaviyo flow
 * engine. Same architecture as payment-ops: idempotent cron sweeps over
 * existing tables, with email_outbox's (to_email, template, related_id) unique
 * index for one intent per stage. Provider delivery uses a separately leased
 * worker with bounded idempotency; it is not an exactly-once guarantee. No scheduling column, no state
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
import { readAll } from "./read-all";
import { queueEmail, type EmailTemplate } from "./email";
import {
  isTransactional,
  replenishmentDays,
  replenishmentRelatedId,
  reviewRelatedId,
  reviewThanksRelatedId,
  secondPurchaseRelatedId,
  welcomeRelatedId,
  winbackRelatedId,
  type SequenceId,
} from "./sequences";
import { pausedEmailsFor } from "./overrides";
import { unsubscribeUrl } from "@/lib/email/unsubscribe";

const SITE = "https://www.eastcoastlabs.com.au";
const DAY_MS = 86_400_000;

const daysSince = (iso: string) => (Date.now() - new Date(iso).getTime()) / DAY_MS;
const isoDaysAgo = (days: number) => new Date(Date.now() - days * DAY_MS).toISOString();

/** Bound URL/filter size independently of result size: one email can have
 * many matching rows, so every chunk also needs stable result pagination. */
async function readChunks<T>(values:string[], page:(ids:string[],start:number,end:number)=>PromiseLike<{data:T[]|null;error:{message:string}|null}>):Promise<T[]> {
  const unique=[...new Set(values)];const rows:T[]=[];
  for(let offset=0;offset<unique.length;offset+=200){
    const ids=unique.slice(offset,offset+200);
    rows.push(...await readAll<T>((start,end)=>page(ids,start,end)));
  }
  return rows;
}

/** Emails with unsubscribed_at set on any subscribers row. */
async function suppressedEmails(emails: string[]): Promise<Set<string>> {
  const unique = [...new Set(emails)];
  if (!unique.length) return new Set();
  const data = await readChunks(unique,(ids,start,end)=>adminDb()
    .from("subscribers")
    .select("email")
    .in("email", ids)
    .not("unsubscribed_at", "is", null).order("id").range(start,end));
  return new Set((data ?? []).map((r) => (r as { email: string }).email));
}

interface MarketingSend {
  to: string;
  template: EmailTemplate;
  payload?: Record<string, unknown>;
  relatedType: string;
  relatedId: string;
}

/**
 * Slugs of products that are consumables rather than the thing a researcher
 * would review — syringes, swabs, the starter kit. An order containing only
 * these gets the arrival check-in but never a review ask: "rate your alcohol
 * swabs" produces nothing anyone reads.
 *
 * Read from `products.categories` so adding an accessory in the admin is enough;
 * an empty result means every order is treated as reviewable. A failed read
 * stops the sweep so missing catalogue data cannot trigger unwanted requests.
 */
async function accessorySlugs(): Promise<Set<string>> {
  const data = await readAll((start,end)=>adminDb().from("products").select("slug").contains("categories", ["accessory"]).order("id").range(start,end));
  return new Set((data ?? []).map((p) => (p as { slug: string }).slug));
}

/**
 * Emails that received any NON-transactional email in the last `days` days.
 * Used to make a low-priority touch yield rather than land on the same day as a
 * higher-priority one — the "one flow email per person per day" rule, applied at
 * the only place it currently bites.
 */
async function recentMarketingRecipients(emails: string[], days: number): Promise<Set<string>> {
  const unique = [...new Set(emails)];
  if (!unique.length) return new Set();
  const since=isoDaysAgo(days);
  const data = await readChunks(unique,(ids,start,end)=>adminDb()
    .from("email_outbox")
    .select("to_email, template")
    .in("to_email", ids)
    .gte("created_at", since).order("id").range(start,end));
  return new Set(
    ((data ?? []) as { to_email: string; template: EmailTemplate }[])
      .filter((r) => !isTransactional(r.template))
      .map((r) => r.to_email),
  );
}

/**
 * Queue marketing sends, applying suppression, operator pauses, and
 * unsubscribe-link injection. The pause check lives HERE rather than in each
 * sweep's query so a paused person is skipped no matter which sweep reached
 * them — one place to be right instead of five.
 */
async function queueMarketing(sends: MarketingSend[], sequence?: SequenceId): Promise<number> {
  if (!sends.length) return 0;
  const suppressed = await suppressedEmails(sends.map((s) => s.to));
  const paused = sequence ? await pausedEmailsFor(sequence) : new Set<string>();
  let queued = 0;
  for (const send of sends) {
    if (suppressed.has(send.to)) continue;
    if (paused.has(send.to)) continue;
    const unsub = unsubscribeUrl(send.to);
    if (!unsub) throw new Error("Lifecycle unsubscribe signing secret is not configured");
    const inserted = await queueEmail({
      to: send.to,
      template: send.template,
      payload: { ...(send.payload ?? {}), unsubscribe_url: unsub },
      relatedType: send.relatedType,
      relatedId: send.relatedId,
    });
    if (inserted) queued++;
  }
  return queued;
}

/**
 * Lifetime welcome series: stage 1 is queued on mailbox confirmation, and stage 3
 * keeps the original subscriber date. Renewed consent does not replay either touch.
 * A subscriber leaves the series the moment they place any order — the series'
 * job is the first purchase.
 */
export async function sweepWelcomeSeries(): Promise<{ queued: number }> {
  const db = adminDb();
  const since=isoDaysAgo(18);
  const data = await readAll((start,end)=>db
    .from("subscribers")
    .select("email, source, created_at")
    .is("unsubscribed_at", null)
    .gte("created_at", since)
    .order("created_at", { ascending: true }).order("id").range(start,end));

  const bySubscriber = new Map<string, string>();
  for (const row of (data ?? []) as { email: string; source: string | null; created_at: string }[]) {
    const source = row.source ?? "";
    if (source.startsWith("back_in_stock:") || source === "unsubscribe") continue;
    if (!bySubscriber.has(row.email)) bySubscriber.set(row.email, row.created_at);
  }
  if (!bySubscriber.size) return { queued: 0 };

  const orderRows = await readChunks([...bySubscriber.keys()],(ids,start,end)=>db
    .from("orders")
    .select("customer_email")
    .in("customer_email", ids).order("id").range(start,end));
  const purchased = new Set((orderRows ?? []).map((r) => (r as { customer_email: string }).customer_email));

  const stages: { days: number; n: 3; template: EmailTemplate }[] = [
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
          relatedId: welcomeRelatedId(email, stage.n),
        });
      }
    }
  }
  return { queued: await queueMarketing(sends, "welcome") };
}

interface FulfilledOrderRow {
  id: string;
  order_number: string;
  customer_email: string;
  created_at: string;
  shipped_at: string;
}

interface ReviewOrderRow extends FulfilledOrderRow {
  order_items: { product_slug: string; product_name: string }[];
}

/** The review form URL for an order — the emails append &rating=N per star. */
const reviewUrlFor = (order: FulfilledOrderRow) =>
  `${SITE}/leave-a-review?token=${createOrderAccessToken(order.id, "review")}`;

/**
 * Post-purchase review sequence — three touches off shipped_at.
 *
 * Stage order is the whole point. The arrival check-in at day 5 gives a bad
 * delivery somewhere to go BEFORE we ask for a public rating, so problems arrive
 * as support tickets rather than one-star reviews. We are not filtering
 * sentiment: whatever the review says gets published, and the check-in goes to
 * every fulfilled order regardless of what's in it.
 *
 * Only the two review asks are gated on the order actually containing something
 * reviewable (a peptide, not just syringes) and on no review existing yet.
 * Refunded and cancelled orders never appear here at all — the status filter
 * excludes them, which is deliberate: asking someone you refunded to rate you is
 * the fastest way to earn the rating you deserve for asking.
 */
export async function sweepPostPurchase(): Promise<{ queued: number }> {
  const db = adminDb();
  const since=isoDaysAgo(45);
  const data = await readAll((start,end)=>db
    .from("orders")
    .select(
      "id, order_number, customer_email, created_at, shipped_at, order_items(product_slug, product_name)",
    )
    .in("status", ["shipped", "completed"])
    .not("shipped_at", "is", null)
    .gte("shipped_at", since)
    .order("shipped_at").order("id").range(start,end));
  const orders = (data ?? []) as unknown as ReviewOrderRow[];
  if (!orders.length) return { queued: 0 };

  const [reviewRows, accessories] = await Promise.all([
    readChunks(orders.map((o)=>o.id),(ids,start,end)=>db.from("reviews").select("order_id").in("order_id",ids).order("id").range(start,end)),
    accessorySlugs(),
  ]);
  const reviewed = new Set((reviewRows ?? []).map((r) => (r as { order_id: string }).order_id));

  /** Products worth reviewing — accessories alone aren't social proof. */
  const reviewableItems = (order: ReviewOrderRow) =>
    (order.order_items ?? []).filter((i) => !accessories.has(i.product_slug));

  // The reminder is the one touch at real risk of colliding with another
  // sequence (a 1-vial buyer's replenishment lands at shipped+21d), so it yields
  // to any marketing email this person received in the last three days.
  const reminderCandidates = orders.filter((o) => {
    const age = daysSince(o.shipped_at);
    return age >= 24 && age < 35;
  });
  const recentlyEmailed = await recentMarketingRecipients(
    reminderCandidates.map((o) => o.customer_email),
    3,
  );

  const sends: MarketingSend[] = [];
  for (const order of orders) {
    const age = daysSince(order.shipped_at);
    const relatedId = reviewRelatedId(order.id);

    if (age >= 5 && age < 10) {
      sends.push({
        to: order.customer_email,
        template: "arrival_checkin",
        payload: { order_number: order.order_number },
        relatedType: "order",
        relatedId,
      });
      continue;
    }

    const items = reviewableItems(order);
    if (!items.length || reviewed.has(order.id)) continue;
    const payload = {
      order_number: order.order_number,
      review_url: reviewUrlFor(order),
      order_id: order.id,
      products: [...new Set(items.map((i) => i.product_name))],
    };

    if (age >= 14 && age < 21) {
      sends.push({
        to: order.customer_email,
        template: "post_purchase_review",
        payload,
        relatedType: "order",
        relatedId,
      });
    } else if (age >= 24 && age < 35 && !recentlyEmailed.has(order.customer_email)) {
      sends.push({
        to: order.customer_email,
        template: "post_purchase_review_reminder",
        payload,
        relatedType: "order",
        relatedId,
      });
    }
  }
  return { queued: await queueMarketing(sends, "post_purchase_review") };
}

interface ReviewRow {
  id: string;
  created_at: string;
  rating: number;
  orders: { customer_email: string } | null;
}

/**
 * Thank-you the day after a review lands, with a soft referral ask.
 *
 * Anchored on the REVIEW's created_at rather than the order's, because the
 * trigger is the act of reviewing. Runs regardless of moderation outcome and
 * regardless of rating — a one-star reviewer who took the time deserves the
 * same acknowledgement, and the copy promises nothing about publication beyond
 * "we screen for spam".
 */
export async function sweepReviewThankYou(): Promise<{ queued: number }> {
  const db = adminDb();
  const since=isoDaysAgo(7);
  const data = await readAll((start,end)=>db
    .from("reviews")
    .select("id, created_at, rating, orders(customer_email)")
    .not("order_id", "is", null)
    .gte("created_at", since)
    .order("created_at").order("id").range(start,end));
  const reviews = (data ?? []) as unknown as ReviewRow[];

  const sends: MarketingSend[] = [];
  for (const review of reviews) {
    const email = review.orders?.customer_email;
    if (!email) continue;
    const age = daysSince(review.created_at);
    if (age < 1 || age >= 7) continue;
    sends.push({
      to: email,
      template: "review_thank_you",
      payload: { rating: review.rating },
      relatedType: "review",
      relatedId: reviewThanksRelatedId(review.id),
    });
  }
  return { queued: await queueMarketing(sends, "review_thank_you") };
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

/**
 * Replenishment: nudge each customer's LATEST fulfilled order once its
 * pack-size-scaled consumption window has passed — unless they've ordered
 * again since.
 */
export async function sweepReplenishment(): Promise<{ queued: number }> {
  const db = adminDb();
  const since=isoDaysAgo(200);
  const data = await readAll((start,end)=>db
    .from("orders")
    .select(
      "id, order_number, customer_email, created_at, shipped_at, order_items(product_name, qty, variant_label, product_variants(pack_size))",
    )
    .in("status", ["shipped", "completed"])
    .not("shipped_at", "is", null)
    .gte("shipped_at", since)
    .order("shipped_at").order("id").range(start,end));
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
  const allOrders = await readChunks([...latestByEmail.keys()],(ids,start,end)=>db
    .from("orders")
    .select("customer_email, created_at")
    .in("customer_email", ids)
    .neq("status", "cancelled").order("id").range(start,end));
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
      relatedId: replenishmentRelatedId(order.id),
    });
  }
  return { queued: await queueMarketing(sends, "replenishment") };
}

interface CustomerRow {
  email: string;
  orders_count: number;
  last_order_at: string;
}

/** Winback: 60d and 90d inactivity touches, each sent at most once per lapse. */
export async function sweepWinback(): Promise<{ queued: number }> {
  const db = adminDb();
  const since=isoDaysAgo(150);const until=isoDaysAgo(60);
  const data = await readAll((start,end)=>db
    .from("customers")
    .select("email, orders_count, last_order_at")
    .gte("last_order_at", since)
    .lte("last_order_at", until)
    .order("last_order_at").order("email").range(start,end));
  const customers = (data ?? []) as CustomerRow[];

  const sends: MarketingSend[] = [];
  for (const customer of customers) {
    const age = daysSince(customer.last_order_at);
    if (age >= 60 && age < 90) {
      sends.push({
        to: customer.email,
        template: "winback_60",
        relatedType: "customer",
        relatedId: winbackRelatedId(customer.email, 60, customer.last_order_at),
      });
    } else if (age >= 90 && age < 150) {
      sends.push({
        to: customer.email,
        template: "winback_90",
        relatedType: "customer",
        relatedId: winbackRelatedId(customer.email, 90, customer.last_order_at),
      });
    }
  }
  return { queued: await queueMarketing(sends, "winback") };
}

/**
 * Day-30 second-purchase nudge — the 1st→2nd order conversion. Skips anyone
 * who got a replenishment email recently (a 1-vial buyer's replenishment lands
 * at day 21; stacking a near-identical nudge 9 days later reads as spam).
 */
export async function sweepSecondPurchaseNudge(): Promise<{ queued: number }> {
  const db = adminDb();
  const since=isoDaysAgo(60);const until=isoDaysAgo(30);
  const data = await readAll((start,end)=>db
    .from("customers")
    .select("email, orders_count, last_order_at")
    .eq("orders_count", 1)
    .gte("last_order_at", since)
    .lte("last_order_at", until)
    .order("last_order_at").order("email").range(start,end));
  const customers = (data ?? []) as CustomerRow[];
  if (!customers.length) return { queued: 0 };

  const recentSince=isoDaysAgo(30);
  const recentReplenishment = await readChunks(customers.map((c)=>c.email),(ids,start,end)=>db
    .from("email_outbox")
    .select("to_email")
    .eq("template", "replenishment")
    .in("to_email", ids)
    .gte("created_at", recentSince).order("id").range(start,end));
  const recentlyNudged = new Set(
    (recentReplenishment ?? []).map((r) => (r as { to_email: string }).to_email),
  );

  const sends: MarketingSend[] = customers
    .filter((c) => !recentlyNudged.has(c.email))
    .map((c) => ({
      to: c.email,
      template: "second_purchase_nudge",
      relatedType: "customer",
      relatedId: secondPurchaseRelatedId(c.email, c.last_order_at),
    }));
  return { queued: await queueMarketing(sends, "second_purchase") };
}
