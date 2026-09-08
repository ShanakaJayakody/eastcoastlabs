import "server-only";
import { Resend } from "resend";
import { adminDb } from "@/lib/admin/db";
import { renderTemplate } from "./templates";
import { unsubscribeUrl } from "./unsubscribe";
import { isTransactional } from "@/lib/admin/sequences";
import type { EmailTemplate } from "@/lib/admin/email";

interface OutboxRow { id: string; to_email: string; template: EmailTemplate; payload: Record<string, unknown>; lease_token: string; rendered_subject?: string; rendered_html?: string }
interface DeliveryResult { ok: boolean; cancelled?: boolean; error?: string; messageId?: string }
const FROM = process.env.RESEND_FROM_EMAIL || "East Coast Labs <orders@eastcoastlabs.com.au>";

/** Rendering and eligibility happen before the final check. The RPC verifies
 * the current lease, opt-out, operator pause and order/cart state just before sending. */
async function sendOne(row: OutboxRow): Promise<DeliveryResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "RESEND_API_KEY not configured" };
  try {
    let payload = row.payload ?? {};
    if (!isTransactional(row.template) && row.template !== "subscription_confirmation" && row.template !== "cart_recovery_confirmation") {
      const url = unsubscribeUrl(row.to_email);
      if (!url) return { ok: false, error: "Unsubscribe signing secret is not configured" };
      payload = { ...payload, unsubscribe_url: url };
    }
    const rendered = row.rendered_subject && row.rendered_html
      ? { subject: row.rendered_subject, html: row.rendered_html }
      : await renderTemplate(row.template, payload);
    const { data: message, error: prepareError } = await adminDb().rpc("prepare_email_delivery", {
      p_id: row.id, p_lease: row.lease_token, p_subject: rendered.subject, p_html: rendered.html,
    });
    if (prepareError || !message?.subject || !message?.html) return { ok: false, error: `Cannot freeze email body: ${prepareError?.message ?? "missing message"}` };
    const { subject, html } = message as { subject: string; html: string };
    const { data: allowed, error: eligibilityError } = await adminDb().rpc("authorize_email_delivery", { p_id: row.id, p_lease: row.lease_token });
    if (eligibilityError) return { ok: false, error: `Eligibility check failed: ${eligibilityError.message}` };
    if (!allowed) return { ok: false, cancelled: true };
    const { data, error } = await new Resend(key).emails.send(
      { from: FROM, to: row.to_email, subject, html },
      { idempotencyKey: `ecl-outbox/${row.id}` },
    );
    if (error) return { ok: false, error: error.message };
    if (!data?.id) return { ok: false, error: "Provider returned no message identity" };
    return { ok: true, messageId: data.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function deliverClaimed(rows: OutboxRow[]) {
  let sent=0, failed=0, cancelled=0;
  for (const row of rows) {
    const result = await sendOne(row);
    if (result.cancelled) { cancelled++; continue; } // RPC already terminalised it, or lease belongs to another worker.
    const { error } = await adminDb().rpc("finish_email_outbox", {
      p_id: row.id, p_lease: row.lease_token, p_status: result.ok ? "sent" : "failed",
      p_error: result.error ?? null, p_provider_id: result.messageId ?? null,
    });
    // Never report sent/failed bookkeeping success if the write failed. The
    // lease will expire; retries retain the same provider identity.
    if (error) throw new Error(`Cannot persist delivery outcome for ${row.id}; reconcile provider: ${error.message}`);
    if (result.ok) sent++; else failed++;
  }
  return { sent, failed, cancelled };
}
export async function sendImmediately(rowId: string): Promise<void> {
  const { data, error } = await adminDb().rpc("claim_email_outbox", { p_limit: 1, p_id: rowId });
  if (error) throw new Error(`Cannot claim email: ${error.message}`);
  await deliverClaimed((data ?? []) as OutboxRow[]);
}
export async function drainOutbox(limit = 50): Promise<{ sent: number; failed: number; cancelled: number }> {
  // Claim one at a time so a slow provider cannot let later rows in a batch
  // expire their leases before this worker starts them.
  let sent=0, failed=0, cancelled=0;
  for (let i=0; i<Math.max(1,Math.min(100,limit)); i++) {
    const { data, error } = await adminDb().rpc("claim_email_outbox", { p_limit: 1, p_id: null });
    if (error) throw new Error(`Cannot claim outbox: ${error.message}`);
    if (!data?.length) break;
    const result = await deliverClaimed(data as OutboxRow[]);
    sent+=result.sent; failed+=result.failed; cancelled+=result.cancelled;
  }
  return { sent, failed, cancelled };
}

/** Prioritise newly committed order email after the HTTP response. Cron also
 * discovers these rows if the request worker exits before its callback runs. */
export async function dispatchOrderEmails(orderId: string): Promise<void> {
  const { data, error } = await adminDb().from("email_outbox").select("id")
    .eq("payload->>order_id", orderId).in("status", ["queued", "failed"]).order("created_at").limit(10);
  if (error) throw new Error(`Cannot read order notifications: ${error.message}`);
  for (const row of data ?? []) await sendImmediately(row.id);
}
