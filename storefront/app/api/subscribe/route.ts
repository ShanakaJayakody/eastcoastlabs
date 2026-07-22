import { NextResponse } from "next/server";

/**
 * Email-capture endpoint — the single seam for the email platform.
 *
 * Today it validates and logs (no ESP configured yet). When Klaviyo (or any
 * ESP) is wired, forward the payload here — the `source` field distinguishes
 * newsletter / exit-intent / back-in-stock so it can route to the right list
 * or flow. No client code changes needed when that lands.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: string; source?: string; meta?: unknown };
    const email = (body.email ?? "").trim();

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
    }

    // TODO(payment/ESP): POST to Klaviyo subscribe endpoint using the site key.
    // For now we just record the intent server-side.
    console.log(`[subscribe] ${email} · source=${body.source ?? "unknown"}`);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }
}
