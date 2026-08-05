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
import { queueEmail, type EmailTemplate } from "./email";
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
 * activity). Disjoint windows mean a cart matches at most one stage per sweep,
 * so a stale cart discovered late (first deploy, cron outage) gets the single
 * currently-due touch — never a burst of all three. Carts idle past the last
 * window get nothing: recovering a week-old cart reads as surveillance, not
 * service.
 */
const CART_STAGES: { from: number; until: number; template: EmailTemplate }[] = [
  { from: 1, until: 24, template: "abandoned_cart" },
  { from: 24, until: 72, template: "abandoned_cart_2" },
  { from: 72, until: 168, template: "abandoned_cart_3" },
];

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

  for (let stage = 0; stage < CART_STAGES.length; stage++) {
    const { from, until, template } = CART_STAGES[stage];
    const idleSince = new Date(Date.now() - from * 60 * 60 * 1000).toISOString();
    const idleUntil = new Date(Date.now() - until * 60 * 60 * 1000).toISOString();

    const { data: claimed } = await db
      .from("cart_sessions")
      .update({ reminder_stage: stage + 1, reminder_sent_at: new Date().toISOString() })
      .eq("status", "active")
      .lte("reminder_stage", stage)
      .lt("updated_at", idleSince)
      .gt("updated_at", idleUntil)
      .select("email, cart, subtotal_cents, updated_at");

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
        relatedId: `${email}:cart:${stage + 1}:${Date.parse(row.updated_at as string)}`,
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

export async function abandonedCartCount(idleHours = 1): Promise<number> {
  const cutoff = new Date(Date.now() - idleHours * 60 * 60 * 1000).toISOString();
  const { count } = await adminDb()
    .from("cart_sessions")
    .select("*", { count: "exact", head: true })
    .eq("status", "active")
    .lt("updated_at", cutoff);
  return count ?? 0;
}
