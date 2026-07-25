/**
 * Abandoned-cart capture + recovery.
 *
 * Known structural limit (SystemsThinking review): recovery matching is
 * email-only. If a shopper browses under one email and checks out under a
 * DIFFERENT email, there is no signal connecting the two identities — that cart
 * cannot be suppressed. Mitigation: cap recovery to exactly ONE send per capture
 * (reminder_sent_at not null = permanently excluded, never repeats) and the
 * SAME-email case is fully suppressed via markCartRecovered().
 */
import { adminDb } from "./db";
import { queueEmail } from "./email";

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
 * Atomically claim carts eligible for a recovery email (active, never reminded,
 * idle past the threshold) and queue their emails. UPDATE...RETURNING claims and
 * reads in one statement — the same fix applied to queueBackInStock — so an
 * overlapping cron tick can never double-queue the same cart.
 */
export async function queueAbandonedCartEmails(idleHours = 1): Promise<number> {
  const db = adminDb();
  const cutoff = new Date(Date.now() - idleHours * 60 * 60 * 1000).toISOString();

  const { data: claimed } = await db
    .from("cart_sessions")
    .update({ reminder_sent_at: new Date().toISOString() })
    .eq("status", "active")
    .is("reminder_sent_at", null)
    .lt("updated_at", cutoff)
    .select("email, cart, subtotal_cents");

  const rows = claimed ?? [];
  for (const row of rows) {
    await queueEmail({
      to: row.email as string,
      template: "abandoned_cart",
      payload: { cart: row.cart, subtotal_cents: row.subtotal_cents },
      relatedType: "cart_session",
      relatedId: row.email as string,
    });
  }
  return rows.length;
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
