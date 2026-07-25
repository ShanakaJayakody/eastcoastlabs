/**
 * Transactional email seam. Nothing here sends mail — it queues into
 * email_outbox, which a sender (Resend) will drain in a later phase. Queuing is
 * the verifiable unit: tests and the admin UI can both see what will be sent.
 */
import { adminDb } from "./db";

export type EmailTemplate =
  | "order_confirmation"
  | "order_shipped"
  | "order_refunded"
  | "back_in_stock";

export async function queueEmail(opts: {
  to: string;
  template: EmailTemplate;
  payload?: Record<string, unknown>;
  relatedType?: string;
  relatedId?: string;
}): Promise<void> {
  const { error } = await adminDb().from("email_outbox").insert({
    to_email: opts.to.trim().toLowerCase(),
    template: opts.template,
    payload: opts.payload ?? {},
    related_type: opts.relatedType ?? null,
    related_id: opts.relatedId ?? null,
  });
  if (error) throw new Error(`queueEmail: ${error.message}`);
}

/** Count of pending notifications — surfaced on the dashboard. */
export async function queuedEmailCount(): Promise<number> {
  const { count } = await adminDb()
    .from("email_outbox")
    .select("*", { count: "exact", head: true })
    .eq("status", "queued");
  return count ?? 0;
}
