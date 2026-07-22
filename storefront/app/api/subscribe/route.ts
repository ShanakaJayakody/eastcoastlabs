import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Email-capture endpoint — the single seam for the email platform.
 *
 * Persists to Supabase: a `back_in_stock:<slug>` source goes to
 * stock_notifications; everything else (newsletter, exit-intent) goes to
 * subscribers. If Supabase is unconfigured it degrades to a server log, so the
 * form never errors. (A future ESP forward — Klaviyo — slots in right here.)
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
          .upsert({ email, source }, { onConflict: "email,source" });
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
