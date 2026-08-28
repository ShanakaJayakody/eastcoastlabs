import "server-only";

/**
 * The unpaid-order lifecycle.
 *
 * When payment is customer-initiated, "order placed" and "money received" are
 * separate events that can be hours or days apart — and an order that is never
 * paid holds reserved stock indefinitely. That is the single biggest leak in a
 * card-less checkout, and nothing else in the system closes it.
 *
 * Two sweeps, both idempotent so a cron can run them as often as it likes:
 *
 *   remindUnpaidOrders — nudges orders that have been pending past a cutoff,
 *     at most once per reminder stage, tracked by payment_reminders_sent.
 *   expireUnpaidOrders — cancels orders past payment_expires_at, which releases
 *     their reserved stock through the normal cancel path.
 *
 * Reminder stages are hours-since-created. The cron cadence is a ceiling on
 * precision, not on correctness: whenever the sweep runs, every order that has
 * earned its next reminder gets exactly one.
 */

import { adminDb } from "./db";
import { cancelOrder } from "./orders";
import { queueEmail } from "./email";
import { REMINDER_STAGES, paymentReminderRelatedId } from "./sequences";
import { pausedEmailsFor } from "./overrides";
import { getSettings } from "@/lib/settings";
import { referenceForOrderNumber } from "@/lib/payments";

export { REMINDER_STAGES };

interface PendingOrderRow {
  id: string;
  order_number: string;
  customer_email: string;
  total_cents: number;
  payment_method: string | null;
  payment_reference: string | null;
  payment_reminders_sent: number;
  payment_expires_at: string | null;
  created_at: string;
}

const PENDING_COLS =
  "id, order_number, customer_email, total_cents, payment_method, payment_reference, payment_reminders_sent, payment_expires_at, created_at";

const hoursSince = (iso: string) => (Date.now() - new Date(iso).getTime()) / 3600_000;

/**
 * Queue payment reminders for orders that have gone quiet.
 *
 * An order at stage N has already had N reminders; it earns the next one when
 * its age passes REMINDER_STAGES[N]. The counter is incremented in the same
 * pass, so a re-run cannot double-send even if the email queue is slow.
 */
export async function remindUnpaidOrders(): Promise<{ reminded: number }> {
  const db = adminDb();
  const settings = await getSettings();

  const { data, error } = await db
    .from("orders")
    .select(PENDING_COLS)
    .eq("status", "pending")
    .lt("payment_reminders_sent", REMINDER_STAGES.length)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) throw new Error(`remindUnpaidOrders: ${error.message}`);

  const paused = await pausedEmailsFor("payment_reminders");

  let reminded = 0;
  for (const order of (data ?? []) as PendingOrderRow[]) {
    // An operator settling this payment by phone shouldn't have the system
    // nagging behind them.
    if (paused.has(order.customer_email)) continue;
    const stage = order.payment_reminders_sent;
    const dueAfter = REMINDER_STAGES[stage];
    if (dueAfter === undefined) continue;
    if (hoursSince(order.created_at) < dueAfter) continue;

    // Don't nudge an order that is about to expire anyway — a reminder that
    // arrives after cancellation is worse than no reminder.
    if (order.payment_expires_at && new Date(order.payment_expires_at).getTime() <= Date.now()) {
      continue;
    }

    const reference = order.payment_reference ?? referenceForOrderNumber(order.order_number);
    const hoursLeft = order.payment_expires_at
      ? Math.max(0, Math.round((new Date(order.payment_expires_at).getTime() - Date.now()) / 3600_000))
      : settings.paymentExpiryHours;

    await queueEmail({
      to: order.customer_email,
      template: "payment_reminder",
      payload: {
        order_number: order.order_number,
        order_id: order.id,
        payment_method: order.payment_method ?? "bank_transfer",
        reference,
        amount_cents: order.total_cents,
        hours_left: hoursLeft,
        stage: stage + 1,
      },
      relatedType: "order",
      // The related_id carries the stage so the outbox's dedupe index treats
      // reminder 1 and reminder 2 as distinct notifications for one order.
      relatedId: paymentReminderRelatedId(order.id, stage + 1),
    });

    await db
      .from("orders")
      .update({
        payment_reminders_sent: stage + 1,
        last_reminder_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id)
      // Guard against two sweeps racing: only the one that still sees the old
      // count wins, so the counter can never skip or double-count.
      .eq("payment_reminders_sent", stage);

    reminded++;
  }

  return { reminded };
}

/**
 * Cancel unpaid orders past their hold window, releasing reserved stock.
 *
 * Goes through cancelOrder rather than updating status directly so the stock
 * release, order event, and audit entry all happen exactly as they would for a
 * manual cancellation.
 */
export async function expireUnpaidOrders(): Promise<{ expired: number; failed: number }> {
  const db = adminDb();

  const { data, error } = await db
    .from("orders")
    .select(PENDING_COLS)
    .eq("status", "pending")
    .not("payment_expires_at", "is", null)
    .lt("payment_expires_at", new Date().toISOString())
    .limit(200);
  if (error) throw new Error(`expireUnpaidOrders: ${error.message}`);

  let expired = 0;
  let failed = 0;
  for (const order of (data ?? []) as PendingOrderRow[]) {
    try {
      await cancelOrder(order.id, { actor: "system:payment-expiry" });
      await queueEmail({
        to: order.customer_email,
        template: "payment_expired",
        payload: { order_number: order.order_number, order_id: order.id },
        relatedType: "order",
        relatedId: `${order.id}:expired`,
      }).catch(() => {});
      expired++;
    } catch (err) {
      // One un-cancellable order must not stop the sweep — the rest of the
      // batch still needs its stock back.
      console.error(`expireUnpaidOrders: ${order.order_number} failed:`, err);
      failed++;
    }
  }

  return { expired, failed };
}

/** Count of orders still awaiting payment — surfaced on the admin dashboard. */
export async function unpaidOrderCount(): Promise<number> {
  const { count } = await adminDb()
    .from("orders")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");
  return count ?? 0;
}
