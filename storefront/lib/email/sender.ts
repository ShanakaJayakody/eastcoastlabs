import "server-only";

/**
 * Resend sender + outbox drain.
 *
 * Sending is best-effort and MUST NOT block or fail the caller's business
 * transaction (an order is valid even if its confirmation email fails to send).
 * Every attempt updates the outbox row's status, so failures are visible and
 * retryable via drainOutbox() instead of silently vanishing.
 */
import { Resend } from "resend";
import { adminDb } from "@/lib/admin/db";
import { renderTemplate } from "./templates";
import type { EmailTemplate } from "@/lib/admin/email";

const FROM = process.env.RESEND_FROM_EMAIL || "East Coast Labs <orders@eastcoastlabs.com.au>";

function client(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  return key ? new Resend(key) : null;
}

interface OutboxRow {
  id: string;
  to_email: string;
  template: EmailTemplate;
  payload: Record<string, unknown>;
}

/**
 * Templates that have been retired. Rows queued before removal are still sitting
 * in the outbox; without this guard they'd fall through renderTemplate's default
 * branch and mail a customer a blank "Notification." email.
 */
const RETIRED_TEMPLATES = new Set<string>(["post_purchase_coa", "welcome_2"]);

/**
 * Send one outbox row. Never throws — returns a result the caller persists.
 *
 * The returned messageId is what makes Phase C possible: Resend's webhooks
 * identify an email only by its provider id, so unless we record it at send
 * time there is no way to attach a later "opened" or "bounced" event back to
 * the row that caused it.
 */
export async function sendOne(
  row: OutboxRow,
): Promise<{ ok: boolean; error?: string; messageId?: string }> {
  if (RETIRED_TEMPLATES.has(row.template)) {
    return { ok: false, error: `Template "${row.template}" is retired — not sent.` };
  }
  const resend = client();
  if (!resend) return { ok: false, error: "RESEND_API_KEY not configured" };
  try {
    const { subject, html } = await renderTemplate(row.template, row.payload ?? {});
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: row.to_email,
      subject,
      html,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, messageId: data?.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Attempt to send a single freshly-queued row immediately, updating its status. */
export async function sendImmediately(rowId: string): Promise<void> {
  const db = adminDb();
  const { data: row } = await db
    .from("email_outbox")
    .select("id, to_email, template, payload")
    .eq("id", rowId)
    .maybeSingle();
  if (!row) return;

  const res = await sendOne(row as OutboxRow);
  await db
    .from("email_outbox")
    .update(
      res.ok
        ? {
            status: "sent",
            sent_at: new Date().toISOString(),
            provider_message_id: res.messageId ?? null,
          }
        : { status: "failed", error: res.error },
    )
    .eq("id", rowId);
}

/** Drain queued + failed rows (retry). Used by the cron route. */
export async function drainOutbox(limit = 50): Promise<{ sent: number; failed: number }> {
  const db = adminDb();
  const { data } = await db
    .from("email_outbox")
    .select("id, to_email, template, payload")
    .in("status", ["queued", "failed"])
    .order("created_at", { ascending: true })
    .limit(limit);

  let sent = 0;
  let failed = 0;
  for (const row of (data ?? []) as OutboxRow[]) {
    const res = await sendOne(row);
    if (res.ok) {
      await db
        .from("email_outbox")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          provider_message_id: res.messageId ?? null,
        })
        .eq("id", row.id);
      sent++;
    } else {
      await db.from("email_outbox").update({ status: "failed", error: res.error }).eq("id", row.id);
      failed++;
    }
  }
  return { sent, failed };
}
