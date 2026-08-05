import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { queueEmail } from "@/lib/admin/email";
import { unsubscribeUrl } from "@/lib/email/unsubscribe";

/**
 * Email-capture endpoint — the single seam for the email platform.
 *
 * Persists to Supabase: a `back_in_stock:<slug>` source goes to
 * stock_notifications; everything else (newsletter, exit-intent) goes to
 * subscribers, which also queues welcome email 1 immediately (stages 2/3 are
 * sent by the lifecycle cron sweep). Subscribing again clears any prior
 * unsubscribe — an explicit opt-in renews consent. If Supabase is unconfigured
 * it degrades to a server log, so the form never errors.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: string; source?: string };
    const email = (body.email ?? "").trim().toLowerCase();
    const source = body.source ?? "unknown";

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
    }

    const sb = supabaseAdmin();
    if (sb) {
      if (source.startsWith("back_in_stock:")) {
        const productSlug = source.slice("back_in_stock:".length);
        await sb
          .from("stock_notifications")
          .upsert({ email, product_slug: productSlug }, { onConflict: "email,product_slug" });
      } else {
        await sb
          .from("subscribers")
          .upsert({ email, source, unsubscribed_at: null }, { onConflict: "email,source" });
        // Renew consent across every prior source row, then start the welcome series.
        await sb.from("subscribers").update({ unsubscribed_at: null }).eq("email", email);
        const unsub = unsubscribeUrl(email);
        if (unsub) {
          await queueEmail({
            to: email,
            template: "welcome_1",
            payload: { unsubscribe_url: unsub },
            relatedType: "subscriber",
            relatedId: `${email}:welcome:1`,
          }).catch((err) => console.error("[subscribe] welcome_1 queue failed:", err));
        }
      }
    } else {
      console.log(`[subscribe] (no supabase) ${email} · source=${source}`);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[subscribe] error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
