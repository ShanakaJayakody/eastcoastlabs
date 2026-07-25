import { NextResponse } from "next/server";
import { drainOutbox } from "@/lib/email/sender";

export const dynamic = "force-dynamic";

/**
 * Retry sweep for queued/failed transactional email. Most emails send immediately
 * from queueEmail(); this is the safety net for the ones that didn't (Resend
 * outage, missing key at the time, transient error). Protected by CRON_SECRET so
 * it can't be triggered by an outsider hitting the URL.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  const result = await drainOutbox(100);
  return NextResponse.json(result);
}
