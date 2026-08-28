import { NextResponse } from "next/server";
import { adminDb } from "@/lib/admin/db";
import { logAudit } from "@/lib/admin/audit";
import { verifySvixSignature } from "@/lib/email/webhook-verify";

export const dynamic = "force-dynamic";

/**
 * Resend delivery webhooks — the "did it land?" half of the email system.
 *
 * Always returns 200 once the payload is verified, even when we can't match the
 * event to an outbox row. A webhook endpoint that returns errors for its own
 * bookkeeping problems gets retried, then throttled, then disabled by the
 * provider — losing the events we DO care about.
 */

/** Resend event name -> our enum. Unlisted events are acknowledged and ignored. */
const EVENT_MAP: Record<string, string> = {
  "email.delivered": "delivered",
  "email.opened": "opened",
  "email.clicked": "clicked",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.delivery_delayed": "delayed",
};

interface ResendPayload {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string[] | string;
    subject?: string;
    click?: { link?: string };
    bounce?: { type?: string; subType?: string; message?: string };
  };
}

export async function POST(request: Request) {
  const body = await request.text();

  const verdict = verifySvixSignature(
    body,
    {
      id: request.headers.get("svix-id"),
      timestamp: request.headers.get("svix-timestamp"),
      signature: request.headers.get("svix-signature"),
    },
    process.env.RESEND_WEBHOOK_SECRET,
  );
  if (!verdict.ok) {
    return NextResponse.json({ error: verdict.reason }, { status: verdict.status });
  }

  let payload: ResendPayload;
  try {
    payload = JSON.parse(body) as ResendPayload;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const event = EVENT_MAP[payload.type ?? ""];
  if (!event) return NextResponse.json({ ok: true, ignored: payload.type ?? null });

  const recipient = Array.isArray(payload.data?.to) ? payload.data?.to[0] : payload.data?.to;
  const toEmail = (recipient ?? "").trim().toLowerCase();
  if (!toEmail) return NextResponse.json({ ok: true, ignored: "no recipient" });

  const db = adminDb();
  const messageId = payload.data?.email_id ?? null;

  // Match on the provider id we recorded at send time. Emails sent before Phase C
  // have no id stored, so fall back to this recipient's most recent send — a
  // slightly fuzzy attribution is far better than dropping the event entirely.
  let outboxId: string | null = null;
  if (messageId) {
    const { data } = await db
      .from("email_outbox")
      .select("id")
      .eq("provider_message_id", messageId)
      .maybeSingle();
    outboxId = (data as { id: string } | null)?.id ?? null;
  }
  if (!outboxId) {
    const { data } = await db
      .from("email_outbox")
      .select("id")
      .eq("to_email", toEmail)
      .eq("status", "sent")
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    outboxId = (data as { id: string } | null)?.id ?? null;
  }

  // Webhooks are at-least-once. svix-id is the provider's own event identifier,
  // so it's the natural dedupe key for a redelivery.
  const providerEventId = request.headers.get("svix-id");

  const { error } = await db.from("email_events").upsert(
    {
      outbox_id: outboxId,
      to_email: toEmail,
      event,
      provider_event_id: providerEventId,
      detail: {
        message_id: messageId,
        link: payload.data?.click?.link ?? null,
        bounce_type: payload.data?.bounce?.type ?? null,
        bounce_subtype: payload.data?.bounce?.subType ?? null,
        bounce_message: payload.data?.bounce?.message ?? null,
      },
      occurred_at: payload.created_at ?? new Date().toISOString(),
    },
    { onConflict: "provider_event_id", ignoreDuplicates: true },
  );
  if (error) console.error("resend webhook: event insert failed", error.message);

  await maybeSuppress(event, payload, toEmail);

  return NextResponse.json({ ok: true, event, matched: Boolean(outboxId) });
}

/**
 * Stop mailing an address that can't receive mail.
 *
 * Permanent bounces and spam complaints only. A transient bounce — a full
 * mailbox, a server having a bad afternoon — must NOT cost a real customer
 * their email; those are recorded and left alone. Suppression is marketing-only
 * by construction: it sets subscribers.unsubscribed_at, which the lifecycle
 * sweeps consult and the transactional path does not.
 */
async function maybeSuppress(event: string, payload: ResendPayload, toEmail: string) {
  const permanent = (payload.data?.bounce?.type ?? "").toLowerCase() === "permanent";
  const shouldSuppress = event === "complained" || (event === "bounced" && permanent);
  if (!shouldSuppress) return;

  const db = adminDb();
  const now = new Date().toISOString();
  const reason = event === "complained" ? "complaint" : "bounce";

  const { data: existing } = await db.from("subscribers").select("id").eq("email", toEmail);
  if ((existing ?? []).length) {
    await db
      .from("subscribers")
      .update({ unsubscribed_at: now })
      .eq("email", toEmail)
      .is("unsubscribed_at", null);
  } else {
    await db
      .from("subscribers")
      .upsert({ email: toEmail, source: reason, unsubscribed_at: now }, { onConflict: "email,source" });
  }

  await logAudit({
    actor: "system:resend-webhook",
    action: `marketing.auto_suppress.${reason}`,
    entityType: "customer",
    entityId: toEmail,
    diff: {
      event,
      bounce_type: payload.data?.bounce?.type ?? null,
      message: payload.data?.bounce?.message ?? null,
    },
  });
}
