/**
 * Abandoned-cart capture + recovery — three touches (+1h / +24h / +72h).
 *
 * Known structural limit (SystemsThinking review): recovery matching is
 * email-only. If a shopper browses under one email and checks out under a
 * DIFFERENT email, there is no signal connecting the two identities — that cart
 * cannot be suppressed. Mitigation: each capture gets at most one send per
 * stage (reminder_stage is claimed atomically before queuing) and the
 * SAME-email completed-order case is fully suppressed via markCartRecovered().
 *
 * Stage timing anchors on updated_at (last cart activity), not on the previous
 * send — a fresh capture resets the stage counter and restarts the sequence.
 */
import { adminDb } from "./db";
import { queueEmail } from "./email";
import { CART_STAGES, cartRelatedId } from "./sequences";
import { inList, pausedEmailsFor } from "./overrides";
import { unsubscribeUrl } from "@/lib/email/unsubscribe";

export interface CapturedLine {
  name: string;
  variantLabel: string;
  quantity: number;
}

/** Upsert the shopper's current cart against their email. Overwrites any prior
 *  snapshot and resets the reminder gate — a fresh capture deserves a fresh window. */
export async function captureCart(
  email: string,
  cart: CapturedLine[],
  subtotalCents: number,
): Promise<void> {
  const clean = email.trim().toLowerCase();
  if (!clean.includes("@") || !cart.length) return;
  const db = adminDb();
  await db.from("cart_sessions").upsert(
    {
      email: clean,
      cart,
      subtotal_cents: subtotalCents,
      status: "active",
      reminder_sent_at: null,
      reminder_stage: 0,
      recovered_order_id: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "email" },
  );
}

/** Suppress recovery for this email — called right after a successful checkout. */
export async function markCartRecovered(email: string, orderId: string): Promise<void> {
  const clean = email.trim().toLowerCase();
  const { error } = await adminDb()
    .from("cart_sessions")
    .update({ status: "recovered", recovered_order_id: orderId, updated_at: new Date().toISOString() })
    .eq("email", clean)
    .eq("status", "active");
  // Never swallow this silently — a failed suppression means a real customer
  // gets a "you left this in your cart" email after they already bought it.
  if (error) throw new Error(`markCartRecovered: ${error.message}`);
}

/**
 * Recovery touches with DISJOINT idle-time windows (hours since last cart
 * activity) now live in sequences.ts, shared with the admin UI so the stepper
 * predicts exactly what this sweep will do. Disjoint windows mean a cart matches
 * at most one stage per sweep, so a stale cart discovered late (first deploy,
 * cron outage) gets the single currently-due touch — never a burst of all three.
 * Carts idle past the last window get nothing: recovering a week-old cart reads
 * as surveillance, not service.
 */

/**
 * Atomically claim carts eligible for their next recovery touch and queue the
 * stage's email. UPDATE...RETURNING claims and reads in one statement — the
 * same fix applied to queueBackInStock — so an overlapping cron tick can never
 * double-queue the same cart+stage. The outbox's dedupe index is the second
 * seatbelt: relatedId carries the capture's updated_at, so re-captures start a
 * fresh sequence while a re-run of the same capture can't double-send.
 */
export async function queueAbandonedCartEmails(): Promise<number> {
  const db = adminDb();
  let queued = 0;

  // Paused carts are excluded BEFORE the claim, not after: the claim bumps
  // reminder_stage, so claiming a paused cart would silently consume its next
  // touch and the operator's pause would cost them the email they were trying
  // to hold back.
  const paused = inList(await pausedEmailsFor("cart_recovery"));

  for (let stage = 0; stage < CART_STAGES.length; stage++) {
    const { from, until, template } = CART_STAGES[stage];
    const idleSince = new Date(Date.now() - from * 60 * 60 * 1000).toISOString();
    const idleUntil = new Date(Date.now() - until * 60 * 60 * 1000).toISOString();

    let claim = db
      .from("cart_sessions")
      .update({ reminder_stage: stage + 1, reminder_sent_at: new Date().toISOString() })
      .eq("status", "active")
      .lte("reminder_stage", stage)
      .lt("updated_at", idleSince)
      .gt("updated_at", idleUntil);
    if (paused) claim = claim.not("email", "in", paused);
    const { data: claimed } = await claim.select("email, cart, subtotal_cents, updated_at");

    const rows = claimed ?? [];
    if (!rows.length) continue;

    const { data: unsubRows } = await db
      .from("subscribers")
      .select("email")
      .in("email", rows.map((r) => r.email as string))
      .not("unsubscribed_at", "is", null);
    const suppressed = new Set((unsubRows ?? []).map((r) => (r as { email: string }).email));

    for (const row of rows) {
      const email = row.email as string;
      if (suppressed.has(email)) continue;
      const unsub = unsubscribeUrl(email);
      if (!unsub) {
        console.error("cart-recovery: no unsubscribe secret configured — marketing sends skipped");
        return queued;
      }
      await queueEmail({
        to: email,
        template,
        payload: { cart: row.cart, subtotal_cents: row.subtotal_cents, unsubscribe_url: unsub },
        relatedType: "cart_session",
        relatedId: cartRelatedId(email, stage + 1, row.updated_at as string),
      });
      queued++;
    }
  }
  return queued;
}

export interface AbandonedCartRow {
  email: string;
  subtotal_cents: number;
  updated_at: string;
  reminder_sent_at: string | null;
}

/** Active (not yet recovered) carts idle past the threshold — dashboard visibility. */
export async function listAbandonedCarts(idleHours = 1, limit = 10): Promise<AbandonedCartRow[]> {
  const cutoff = new Date(Date.now() - idleHours * 60 * 60 * 1000).toISOString();
  const { data } = await adminDb()
    .from("cart_sessions")
    .select("email, subtotal_cents, updated_at, reminder_sent_at")
    .eq("status", "active")
    .lt("updated_at", cutoff)
    .order("updated_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as AbandonedCartRow[];
}

export interface RecoveryCartRow {
  email: string;
  cart: CapturedLine[];
  subtotal_cents: number;
  status: string;
  reminder_stage: number | null;
  reminder_sent_at: string | null;
  recovered_order_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Carts for the recovery centre's three tabs. */
export async function listCartsFor(
  tab: "active" | "recovered" | "expired",
  limit = 50,
): Promise<RecoveryCartRow[]> {
  const db = adminDb();
  const deadline = new Date(Date.now() - 168 * 60 * 60 * 1000).toISOString();

  let q = db
    .from("cart_sessions")
    .select(
      "email, cart, subtotal_cents, status, reminder_stage, reminder_sent_at, recovered_order_id, created_at, updated_at",
    )
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (tab === "recovered") q = q.eq("status", "recovered");
  // "Expired" is an active cart that aged past the last recovery window — the
  // sweep will never touch it again, which is precisely why it needs a list.
  else if (tab === "expired") q = q.eq("status", "active").lt("updated_at", deadline);
  else q = q.eq("status", "active").gte("updated_at", deadline);

  const { data } = await q;
  return (data ?? []) as RecoveryCartRow[];
}

export interface RecoveryMetrics {
  activeCarts: number;
  inSequence: number;
  recovered30d: number;
  revenueRecoveredCents: number;
  /** Recovered ÷ (recovered + still-active + expired), over carts captured in window. */
  recoveryRatePct: number | null;
}

export async function recoveryMetrics(days = 30): Promise<RecoveryMetrics> {
  const db = adminDb();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const idleCutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const [{ data: windowCarts }, { count: activeCarts }, { data: staged }] = await Promise.all([
    db
      .from("cart_sessions")
      .select("status, recovered_order_id")
      .gte("created_at", since),
    db
      .from("cart_sessions")
      .select("*", { count: "exact", head: true })
      .eq("status", "active")
      .lt("updated_at", idleCutoff),
    db
      .from("cart_sessions")
      .select("email")
      .eq("status", "active")
      .gt("reminder_stage", 0),
  ]);

  const rows = (windowCarts ?? []) as { status: string; recovered_order_id: string | null }[];
  const recovered = rows.filter((r) => r.status === "recovered");
  const denominator = rows.length;

  let revenueRecoveredCents = 0;
  const orderIds = recovered.map((r) => r.recovered_order_id).filter(Boolean) as string[];
  if (orderIds.length) {
    const { data: orders } = await db.from("orders").select("total_cents").in("id", orderIds);
    revenueRecoveredCents = (orders ?? []).reduce(
      (sum, o) => sum + ((o as { total_cents: number }).total_cents ?? 0),
      0,
    );
  }

  return {
    activeCarts: activeCarts ?? 0,
    inSequence: (staged ?? []).length,
    recovered30d: recovered.length,
    revenueRecoveredCents,
    recoveryRatePct: denominator > 0 ? Math.round((recovered.length / denominator) * 100) : null,
  };
}

export async function abandonedCartCount(idleHours = 1): Promise<number> {
  const cutoff = new Date(Date.now() - idleHours * 60 * 60 * 1000).toISOString();
  const { count } = await adminDb()
    .from("cart_sessions")
    .select("*", { count: "exact", head: true })
    .eq("status", "active")
    .lt("updated_at", cutoff);
  return count ?? 0;
}
