import { NextResponse } from "next/server";
import { adminDb } from "@/lib/admin/db";
import { logAudit } from "@/lib/admin/audit";
import { verifySvixSignature } from "@/lib/email/webhook-verify";

export const dynamic = "force-dynamic";

// Verified events are acknowledged only after durable persistence; the provider can retry outages.

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
  const toEmail = typeof recipient === "string" ? recipient.trim().toLowerCase() : "";
  if (!toEmail) return NextResponse.json({ ok: true, ignored: "no recipient" });

  const db = adminDb();
  const messageId = payload.data?.email_id ?? null;

  // Unknown provider IDs remain unmatched. Guessing the recipient's latest
  // email would corrupt attribution when deliveries arrive out of order.
  let outboxId: string | null = null;
  if (messageId) {
    const { data, error } = await db.from("email_outbox").select("id")
      .eq("provider_message_id", messageId).eq("to_email", toEmail).maybeSingle();
    if (error) return NextResponse.json({error:"storage_unavailable"},{status:503});
    outboxId = (data as {id:string}|null)?.id ?? null;
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
        link: safeLink(payload.data?.click?.link),
        bounce_type: payload.data?.bounce?.type ?? null,
        bounce_subtype: payload.data?.bounce?.subType ?? null,
        bounce_message: payload.data?.bounce?.message ?? null,
      },
      occurred_at: payload.created_at ?? new Date().toISOString(),
    },
    { onConflict: "provider_event_id", ignoreDuplicates: true },
  );
  if (error) return NextResponse.json({error:"storage_unavailable"},{status:503});
  try { await maybeSuppress(event, payload, toEmail); }
  catch { return NextResponse.json({error:"suppression_unavailable"},{status:503}); }

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
  const reason = event === "complained" ? "complaint" : "bounce";
  const {error}=await db.rpc("suppress_marketing",{p_email:toEmail,p_source:reason});
  if(error)throw new Error("Suppression persistence failed");

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

function safeLink(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (!["https:","http:"].includes(url.protocol)) return null;
    const path = /^\/(pay|checkout|leave-a-review|subscribe|api)(?:\/|$)/.test(url.pathname)
      ? "/private-link" : url.pathname;
    return `${url.origin}${path}`;
  } catch { return null; }
}
