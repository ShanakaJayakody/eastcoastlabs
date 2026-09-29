import { NextResponse } from "next/server";
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * One-click unsubscribe landing. Suppression is email-wide: every subscribers
 * row for the address is flagged, and a source='unsubscribe' row is upserted so
 * order-only customers (who never subscribed) can still opt out of marketing.
 */

function page(title: string, body: string, status = 200): NextResponse {
  return new NextResponse(
    `<!doctype html><html lang="en-AU"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="theme-color" content="#112b43"><title>${title} — East Coast Labs</title>
<style>@font-face{font-family:RebrandSans;src:url('/fonts/commissioner-latin.woff2') format('woff2');font-display:swap}a:focus-visible{outline:3px solid #5d91bd;outline-offset:5px}</style></head>
<body style="margin:0;background:#fbfcfd;color:#152e46;font-family:RebrandSans,Segoe UI,Arial,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;">
<main style="max-width:440px;padding:48px 24px;text-align:center;">
<a href="/" style="display:inline-block;font-weight:700;letter-spacing:0.05em;color:#152e46;margin-bottom:32px;text-decoration:none;">EAST COAST LABS</a>
<h1 style="font-size:30px;font-weight:500;letter-spacing:-.03em;line-height:1.2;margin:0 0 16px;">${title}</h1>
<p style="color:#536577;font-size:16px;line-height:1.7;">${body}</p>
<a href="/contact" style="display:inline-block;margin-top:24px;color:#275b88;text-underline-offset:4px;">Contact us</a>
</main></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } },
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
  if (!sb) return page("Please try again", "We couldn't save your preference. Please try this link again shortly or contact us.", 503);
  const { error } = await sb.rpc("suppress_marketing", { p_email: email, p_source: "unsubscribe" });
  if (error) return page("Please try again", "We couldn't save your preference. Please try this link again shortly or contact us.", 503);

  return page(
    "You're unsubscribed",
    "You won't receive any more marketing emails from us. Order and payment notifications for purchases you make are unaffected.",
  );
}
