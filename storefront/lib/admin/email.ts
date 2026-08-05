/**
 * Transactional email seam. Every notification is written to email_outbox FIRST
 * (the auditable, retryable unit — visible in tests and the admin without sending
 * real mail), then an immediate send is attempted. If RESEND_API_KEY isn't set or
 * the send fails, the row stays queued/failed for the /api/cron/email-outbox
 * drain to retry — sending is best-effort and never blocks the caller.
 *
 * Insert uses upsert+ignoreDuplicates against the (to_email, template, related_id)
 * unique index, so the exact same notification can never be queued twice even if
 * a caller races or retries (closes the duplicate-queue class of bug).
 */
import { adminDb } from "./db";

export type EmailTemplate =
  | "order_confirmation"
  | "order_shipped"
  | "order_refunded"
  | "back_in_stock"
  | "abandoned_cart"
  | "payment_instructions"
  | "payment_reminder"
  | "payment_expired";

export async function queueEmail(opts: {
  to: string;
  template: EmailTemplate;
  payload?: Record<string, unknown>;
  relatedType?: string;
  relatedId?: string;
}): Promise<void> {
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

  // ignoreDuplicates means `data` is null when the row already existed — nothing
  // new to send. Otherwise, attempt immediate delivery (best-effort, non-blocking).
  if (data?.id) {
    const { sendImmediately } = await import("@/lib/email/sender");
    await sendImmediately(data.id).catch(() => {});
  }
}

/** Count of pending notifications — surfaced on the dashboard. */
export async function queuedEmailCount(): Promise<number> {
  const { count } = await adminDb()
    .from("email_outbox")
    .select("*", { count: "exact", head: true })
    .eq("status", "queued");
  return count ?? 0;
}
