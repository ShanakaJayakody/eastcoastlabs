import "server-only";
import { after } from "next/server";
import { adminDb } from "./db";

// The outbox is durable before any delivery is scheduled. Duplicate enqueue is
// harmless; the sender still needs a database lease before it can contact Resend.
export type EmailTemplate =
  | "admin_daily_brief"
  | "subscription_confirmation"
  | "order_confirmation"
  | "order_shipped"
  | "order_refunded"
  | "back_in_stock"
  | "abandoned_cart"
  | "abandoned_cart_2"
  | "abandoned_cart_3"
  | "payment_instructions"
  | "payment_reminder"
  | "payment_expiring"
  | "payment_expired"
  | "welcome_1"
  | "welcome_3"
  | "arrival_checkin"
  | "post_purchase_review"
  | "post_purchase_review_reminder"
  | "review_thank_you"
  | "replenishment"
  | "winback_60"
  | "winback_90"
  | "second_purchase_nudge";

export async function queueEmail(opts: {
  to: string;
  template: EmailTemplate;
  payload?: Record<string, unknown>;
  relatedType?: string;
  relatedId?: string;
}): Promise<boolean> {
  const db = adminDb();
  const { data, error } = await db
    .from("email_outbox")
    .upsert(
      {
        to_email: opts.to.trim().toLowerCase(),
        template: opts.template,
        payload: opts.payload ?? {},
        related_type: opts.relatedType ?? null,
        related_id: opts.relatedId ?? null,
      },
      { onConflict: "to_email,template,related_id", ignoreDuplicates: true },
    )
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`queueEmail: ${error.message}`);

  if (data?.id) {
    try {
      after(async () => {
        const { sendImmediately } = await import("@/lib/email/sender");
        await sendImmediately(data.id).catch(() => console.error("Email delivery deferred to retry worker"));
      });
    } catch {
      // A non-request caller (e.g. a maintenance script) relies on the cron.
    }
  }
  return Boolean(data?.id);
}

/** Count of pending notifications — surfaced on the dashboard. */
export async function queuedEmailCount(): Promise<number> {
  const { count } = await adminDb()
    .from("email_outbox")
    .select("*", { count: "exact", head: true })
    .in("status", ["queued", "failed", "sending", "dead"]);
  return count ?? 0;
}
