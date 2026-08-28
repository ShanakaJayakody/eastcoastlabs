import "server-only";

/**
 * Everything the admin knows about one email identity, assembled in one place.
 *
 * Deliberately keyed on EMAIL rather than a customer id: the people worth
 * managing include subscribers and cart abandoners who have no row in the
 * `customers` view. A person here is "an email we have ever seen".
 *
 * Two exports carry the feature:
 *   deriveSequenceState — where every automated sequence stands right now, and
 *     what fires next. Computed from source-row age against the shared windows
 *     in sequences.ts, cross-referenced with the outbox. No new tracking tables.
 *   buildJourney — one reverse-chronological feed merging emails, order events,
 *     subscription changes and admin actions.
 */
import { adminDb } from "./db";
import {
  CART_STAGES,
  PAYMENT_STAGES,
  REVIEW_STAGES,
  SECOND_PURCHASE_STAGES,
  SEQUENCE_LABELS,
  WELCOME_STAGES,
  WINBACK_STAGES,
  cartRelatedId,
  deriveStages,
  nextEta,
  paymentReminderRelatedId,
  replenishmentRelatedId,
  replenishmentStages,
  reviewRelatedId,
  secondPurchaseRelatedId,
  welcomeRelatedId,
  winbackRelatedId,
  type DerivedStage,
  type OutboxLookupRow,
  type SequenceId,
} from "./sequences";
import type { EmailOutcome, JourneyItem } from "@/components/admin/JourneyTimeline";

export interface CartSessionRow {
  email: string;
  cart: { name: string; variantLabel?: string; quantity: number }[];
  subtotal_cents: number;
  status: string;
  reminder_stage: number | null;
  reminder_sent_at: string | null;
  recovered_order_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SequenceState {
  id: SequenceId;
  label: string;
  /** Still has an unsent, still-eligible touch ahead of it. */
  active: boolean;
  paused: boolean;
  /** Timestamp the windows are measured from. */
  anchorAt: string | null;
  /** One-line operator context, e.g. "Cart captured 3h ago · $263.99". */
  context: string | null;
  stages: DerivedStage[];
  nextEtaMs: number | null;
  /** Order this sequence hangs off, when it is order-scoped. */
  orderId?: string | null;
  /** Extra key the send-now action needs to rebuild the exact related id. */
  anchorKey?: string | null;
}

export interface PersonSummary {
  email: string;
  name: string | null;
  ordersCount: number;
  ltvCents: number;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  subscribed: boolean;
  unsubscribedAt: string | null;
  subscriberSource: string | null;
  tags: string[];
  /** False when this email exists only as a subscriber or abandoned cart. */
  hasOrders: boolean;
  /** True when the email appears nowhere at all. */
  unknown: boolean;
}

interface OrderRow {
  id: string;
  order_number: string;
  status: string;
  total_cents: number;
  created_at: string;
  shipped_at: string | null;
  payment_reminders_sent: number | null;
  payment_expires_at: string | null;
}

const packSizeFromLabel = (label: string): number => {
  const m = /(\d+)\s*-?\s*pack/i.exec(label ?? "");
  return m ? parseInt(m[1], 10) : 1;
};

const FULFILLED = ["shipped", "completed"];

/** Everything about one person, fetched in a single batch. */
export async function loadPerson(email: string) {
  const db = adminDb();
  const clean = email.trim().toLowerCase();

  const [
    { data: customer },
    { data: orders },
    { data: subscribers },
    { data: cart },
    { data: outbox },
    { data: overrides },
    { data: notes },
    { data: profile },
    { data: waitlist },
    { data: events },
  ] = await Promise.all([
    db.from("customers").select("*").eq("email", clean).maybeSingle(),
    db
      .from("orders")
      .select(
        "id, order_number, status, total_cents, created_at, shipped_at, payment_reminders_sent, payment_expires_at",
      )
      .eq("customer_email", clean)
      .order("created_at", { ascending: false }),
    db.from("subscribers").select("source, created_at, unsubscribed_at").eq("email", clean),
    db.from("cart_sessions").select("*").eq("email", clean).maybeSingle(),
    db
      .from("email_outbox")
      .select("id, template, related_id, status, created_at, sent_at, error")
      .eq("to_email", clean)
      .order("created_at", { ascending: false })
      .limit(300),
    db.from("sequence_overrides").select("sequence, action, actor_email, created_at").eq("email", clean),
    db
      .from("customer_notes")
      .select("id, note, actor_email, created_at")
      .eq("email", clean)
      .order("created_at", { ascending: false }),
    db.from("customer_profiles").select("tags").eq("email", clean).maybeSingle(),
    db.from("stock_notifications").select("product_slug, notified").eq("email", clean),
    db
      .from("email_events")
      .select("outbox_id, event, occurred_at")
      .eq("to_email", clean)
      .order("occurred_at", { ascending: true })
      .limit(500),
  ]);

  const orderRows = (orders ?? []) as OrderRow[];
  const subRows = (subscribers ?? []) as {
    source: string | null;
    created_at: string;
    unsubscribed_at: string | null;
  }[];

  const summary: PersonSummary = {
    email: clean,
    name: (customer as { name?: string | null } | null)?.name ?? null,
    ordersCount: (customer as { orders_count?: number } | null)?.orders_count ?? 0,
    ltvCents: (customer as { ltv_cents?: number } | null)?.ltv_cents ?? 0,
    firstOrderAt: (customer as { first_order_at?: string } | null)?.first_order_at ?? null,
    lastOrderAt: (customer as { last_order_at?: string } | null)?.last_order_at ?? null,
    subscribed: subRows.length > 0 && subRows.every((s) => !s.unsubscribed_at),
    unsubscribedAt: subRows.find((s) => s.unsubscribed_at)?.unsubscribed_at ?? null,
    subscriberSource: subRows[0]?.source ?? null,
    tags: ((profile as { tags?: string[] } | null)?.tags ?? []) as string[],
    hasOrders: orderRows.length > 0,
    unknown: !customer && !subRows.length && !cart,
  };

  return {
    summary,
    orders: orderRows,
    cart: (cart ?? null) as CartSessionRow | null,
    outbox: (outbox ?? []) as (OutboxLookupRow & { error?: string | null })[],
    pausedSequences: new Set(
      ((overrides ?? []) as { sequence: string }[]).map((o) => o.sequence),
    ),
    notes: (notes ?? []) as { id: string; note: string; actor_email: string; created_at: string }[],
    waitlist: (waitlist ?? []) as { product_slug: string; notified: boolean }[],
    subscriberRows: subRows,
    emailEvents: (events ?? []) as { outbox_id: string | null; event: string; occurred_at: string }[],
  };
}

export type LoadedPerson = Awaited<ReturnType<typeof loadPerson>>;

const relHours = (iso: string | null): number | null =>
  iso ? (Date.now() - new Date(iso).getTime()) / 3_600_000 : null;

const shortAgo = (iso: string | null): string => {
  const h = relHours(iso);
  if (h == null) return "";
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m ago`;
  if (h < 48) return `${Math.round(h)}h ago`;
  return `${Math.round(h / 24)}d ago`;
};

const aud = (c: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(c / 100);

/**
 * Where every sequence stands for this person.
 *
 * Only sequences that are plausibly relevant are returned — there is no point
 * rendering a winback stepper for someone who ordered yesterday. A sequence is
 * included when it has at least one stage that is sent, due, or upcoming.
 */
export async function deriveSequenceState(person: LoadedPerson): Promise<SequenceState[]> {
  const { summary, orders, cart, outbox, pausedSequences } = person;
  const states: SequenceState[] = [];
  const paused = (id: SequenceId) => pausedSequences.has(id);

  const push = (
    id: SequenceId,
    anchorAt: string | null,
    stages: DerivedStage[],
    context: string | null,
    extra?: { orderId?: string | null; anchorKey?: string | null },
  ) => {
    if (!stages.length) return;
    // Nothing sent and nothing coming — this sequence never touched this person.
    const meaningful = stages.some((s) => s.state !== "missed" && s.state !== "pending");
    if (!meaningful && !stages.some((s) => s.state === "sent")) return;
    states.push({
      id,
      label: SEQUENCE_LABELS[id],
      active: stages.some((s) => s.state === "next"),
      paused: paused(id),
      anchorAt,
      context,
      stages,
      nextEtaMs: nextEta(stages),
      orderId: extra?.orderId ?? null,
      anchorKey: extra?.anchorKey ?? null,
    });
  };

  // ---- Cart recovery -------------------------------------------------------
  if (cart && cart.status === "active") {
    const stages = deriveStages(
      CART_STAGES,
      cart.updated_at,
      (n) => cartRelatedId(summary.email, n, cart.updated_at),
      outbox,
    );
    push(
      "cart_recovery",
      cart.updated_at,
      stages,
      `Cart captured ${shortAgo(cart.updated_at)} · ${aud(cart.subtotal_cents)}`,
      { anchorKey: cart.updated_at },
    );
  }

  // ---- Payment reminders (one sequence per pending order) -------------------
  for (const order of orders.filter((o) => o.status === "pending")) {
    const stages = deriveStages(
      PAYMENT_STAGES,
      order.created_at,
      (n) => paymentReminderRelatedId(order.id, n),
      outbox,
    );
    push(
      "payment_reminders",
      order.created_at,
      stages,
      `${order.order_number} · ${aud(order.total_cents)} awaiting payment`,
      { orderId: order.id },
    );
  }

  // ---- Welcome series ------------------------------------------------------
  const firstSub = person.subscriberRows
    .filter((s) => !(s.source ?? "").startsWith("back_in_stock:") && s.source !== "unsubscribe")
    .sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
  if (firstSub && !summary.hasOrders) {
    const stages = deriveStages(
      WELCOME_STAGES,
      firstSub.created_at,
      (n) => welcomeRelatedId(summary.email, n === 1 ? 1 : 3),
      outbox,
    );
    push("welcome", firstSub.created_at, stages, `Subscribed ${shortAgo(firstSub.created_at)}`);
  }

  // ---- Post-purchase + replenishment (latest fulfilled order) ---------------
  const latestFulfilled = orders
    .filter((o) => FULFILLED.includes(o.status) && o.shipped_at)
    .sort((a, b) => (b.shipped_at ?? "").localeCompare(a.shipped_at ?? ""))[0];

  if (latestFulfilled?.shipped_at) {
    const reviewStages = deriveStages(
      REVIEW_STAGES,
      latestFulfilled.shipped_at,
      () => reviewRelatedId(latestFulfilled.id),
      outbox,
    );
    push(
      "post_purchase_review",
      latestFulfilled.shipped_at,
      reviewStages,
      `${latestFulfilled.order_number} shipped ${shortAgo(latestFulfilled.shipped_at)}`,
      { orderId: latestFulfilled.id },
    );

    // Pack size drives the replenishment threshold, so it needs the line items.
    const { data: items } = await adminDb()
      .from("order_items")
      .select("variant_label, product_variants(pack_size)")
      .eq("order_id", latestFulfilled.id);
    const packSize = Math.max(
      1,
      ...((items ?? []) as unknown as { variant_label: string; product_variants: { pack_size: number } | null }[]).map(
        (i) => i.product_variants?.pack_size ?? packSizeFromLabel(i.variant_label),
      ),
    );
    const replStages = deriveStages(
      replenishmentStages(packSize),
      latestFulfilled.shipped_at,
      () => replenishmentRelatedId(latestFulfilled.id),
      outbox,
    );
    push(
      "replenishment",
      latestFulfilled.shipped_at,
      replStages,
      `Largest pack: ${packSize} · from ${latestFulfilled.order_number}`,
      { orderId: latestFulfilled.id },
    );
  }

  // ---- Winback + second-purchase nudge (customer-level) ---------------------
  if (summary.lastOrderAt) {
    const winStages = deriveStages(
      WINBACK_STAGES,
      summary.lastOrderAt,
      (n) => winbackRelatedId(summary.email, n === 1 ? 60 : 90, summary.lastOrderAt as string),
      outbox,
    );
    push("winback", summary.lastOrderAt, winStages, `Last order ${shortAgo(summary.lastOrderAt)}`, {
      anchorKey: summary.lastOrderAt,
    });

    if (summary.ordersCount === 1) {
      const nudgeStages = deriveStages(
        SECOND_PURCHASE_STAGES,
        summary.lastOrderAt,
        () => secondPurchaseRelatedId(summary.email, summary.lastOrderAt as string),
        outbox,
      );
      push("second_purchase", summary.lastOrderAt, nudgeStages, "One order placed — first repeat", {
        anchorKey: summary.lastOrderAt,
      });
    }
  }

  return states;
}

/* ---------------- journey feed -------------------------------------------- */

const TEMPLATE_SEQUENCE: Record<string, string> = {
  abandoned_cart: "Cart recovery",
  abandoned_cart_2: "Cart recovery",
  abandoned_cart_3: "Cart recovery",
  payment_reminder: "Payment reminders",
  payment_instructions: "Transactional",
  payment_expired: "Payment reminders",
  order_confirmation: "Transactional",
  order_shipped: "Transactional",
  order_refunded: "Transactional",
  welcome_1: "Welcome series",
  welcome_3: "Welcome series",
  post_purchase_review: "Review request",
  replenishment: "Replenishment",
  winback_60: "Winback",
  winback_90: "Winback",
  second_purchase_nudge: "Second-purchase nudge",
  back_in_stock: "Back in stock",
};

export const humanTemplate = (t: string): string =>
  t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * The merged history for one person, newest first.
 *
 * Reads the outbox rather than any per-sequence status column, which is what
 * makes it survive a cart re-capture: `cart_sessions.reminder_stage` resets to 0
 * on a fresh capture, but the emails already sent stay in the outbox forever, so
 * previous recovery rounds remain visible.
 */
export async function buildJourney(
  person: LoadedPerson,
  renderEmailAction?: (row: OutboxLookupRow & { error?: string | null }) => React.ReactNode,
): Promise<JourneyItem[]> {
  const db = adminDb();
  const { summary, orders, outbox, notes, subscriberRows } = person;
  const items: JourneyItem[] = [];

  // Outcomes are ordered by the funnel they describe, not by arrival time, so a
  // row always reads delivered -> opened -> clicked regardless of webhook order.
  const OUTCOME_ORDER: EmailOutcome[] = [
    "delivered",
    "opened",
    "clicked",
    "delayed",
    "bounced",
    "complained",
  ];
  const outcomesByOutbox = new Map<string, Set<string>>();
  for (const e of person.emailEvents) {
    if (!e.outbox_id) continue;
    const set = outcomesByOutbox.get(e.outbox_id) ?? new Set<string>();
    set.add(e.event);
    outcomesByOutbox.set(e.outbox_id, set);
  }

  for (const row of outbox) {
    const seen = outcomesByOutbox.get(row.id);
    items.push({
      id: `email:${row.id}`,
      at: row.sent_at ?? row.created_at,
      kind: "email",
      title: humanTemplate(row.template),
      group: TEMPLATE_SEQUENCE[row.template] ?? null,
      status: row.status as JourneyItem["status"],
      detail: row.error ? `Failed: ${row.error}` : null,
      outcomes: seen ? OUTCOME_ORDER.filter((o) => seen.has(o)) : undefined,
      action: renderEmailAction?.(row),
    });
  }

  const orderIds = orders.map((o) => o.id);
  if (orderIds.length) {
    const { data: events } = await db
      .from("order_events")
      .select("order_id, type, to_status, message, actor_email, created_at")
      .in("order_id", orderIds)
      .order("created_at", { ascending: false })
      .limit(200);
    const numberById = new Map(orders.map((o) => [o.id, o.order_number]));
    for (const e of (events ?? []) as {
      order_id: string;
      type: string;
      to_status: string | null;
      message: string | null;
      actor_email: string | null;
      created_at: string;
    }[]) {
      items.push({
        id: `oe:${e.order_id}:${e.created_at}`,
        at: e.created_at,
        kind: "order",
        title: `${numberById.get(e.order_id) ?? "Order"} — ${e.to_status ?? e.type}`,
        detail: e.message ?? (e.actor_email ? `by ${e.actor_email}` : null),
        group: "Orders",
      });
    }
  }

  for (const s of subscriberRows) {
    items.push({
      id: `sub:${s.created_at}:${s.source ?? ""}`,
      at: s.created_at,
      kind: "subscription",
      title: "Subscribed",
      detail: s.source ? `via ${s.source}` : null,
      group: "Marketing",
    });
    if (s.unsubscribed_at) {
      items.push({
        id: `unsub:${s.unsubscribed_at}`,
        at: s.unsubscribed_at,
        kind: "subscription",
        title: "Unsubscribed",
        detail: s.source === "admin" ? "suppressed by admin" : null,
        group: "Marketing",
      });
    }
  }

  for (const n of notes) {
    items.push({
      id: `note:${n.id}`,
      at: n.created_at,
      kind: "admin",
      title: "Note added",
      detail: `${n.note} — ${n.actor_email}`,
      group: "Admin",
    });
  }

  const { data: audit } = await db
    .from("admin_audit_log")
    .select("actor_email, action, created_at, diff")
    .eq("entity_id", summary.email)
    .order("created_at", { ascending: false })
    .limit(50);
  for (const a of (audit ?? []) as {
    actor_email: string;
    action: string;
    created_at: string;
    diff: unknown;
  }[]) {
    items.push({
      id: `audit:${a.created_at}:${a.action}`,
      at: a.created_at,
      kind: "admin",
      title: humanTemplate(a.action),
      detail: `by ${a.actor_email}`,
      group: "Admin",
    });
  }

  return items.sort((a, b) => b.at.localeCompare(a.at));
}
