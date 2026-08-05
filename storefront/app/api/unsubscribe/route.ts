import { NextResponse } from "next/server";
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * One-click unsubscribe landing. Suppression is email-wide: every subscribers
 * row for the address is flagged, and a source='unsubscribe' row is upserted so
 * order-only customers (who never subscribed) can still opt out of marketing.
 */

function page(title: string, body: string): NextResponse {
  return new NextResponse(
    `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — East Coast Labs</title></head>
<body style="margin:0;background:#080b10;color:#e7ebf2;font-family:-apple-system,Segoe UI,Roboto,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;">
<div style="max-width:420px;padding:40px 24px;text-align:center;">
<div style="font-weight:700;letter-spacing:0.05em;color:#2fd4c8;margin-bottom:24px;">EAST COAST LABS</div>
<h1 style="font-size:20px;margin:0 0 12px;">${title}</h1>
<p style="color:#8b96a8;font-size:14px;line-height:1.6;">${body}</p>
</div></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("t") ?? "";
  const email = verifyUnsubscribeToken(token);
  if (!email) {
    return page(
      "This link didn't work",
      "The unsubscribe link is invalid or incomplete. Reply to any of our emails and we'll remove you manually.",
    );
  }

  const sb = supabaseAdmin();
  if (sb) {
    const now = new Date().toISOString();
    await sb
      .from("subscribers")
      .upsert({ email, source: "unsubscribe", unsubscribed_at: now }, { onConflict: "email,source" });
    await sb.from("subscribers").update({ unsubscribed_at: now }).eq("email", email);
  }

  return page(
    "You're unsubscribed",
    "You won't receive any more marketing emails from us. Order and payment notifications for purchases you make are unaffected.",
  );
}
