import { NextResponse } from "next/server";
import { rejectUnauthorizedCron } from "@/lib/cron-auth";
import { drainOutbox } from "@/lib/email/sender";
import { drainPaidAnalytics } from "@/lib/paid-analytics";
import { recordCronRun } from "@/lib/admin/cron-runs";

export const dynamic = "force-dynamic";

/**
 * Retry sweep for queued/failed transactional email. Most emails send immediately
 * from queueEmail(); this is the safety net for the ones that didn't (Resend
 * outage, missing key at the time, transient error). Protected by CRON_SECRET so
 * it can't be triggered by an outsider hitting the URL.
 */
export async function GET(request: Request) {
  const rejected = rejectUnauthorizedCron(request);
  if (rejected) return rejected;
  const result = await recordCronRun("email-outbox", async () => {
    const email = await drainOutbox(100);
    const analytics = await drainPaidAnalytics(25);
    return { ...email, analytics };
  });
  return NextResponse.json(result);
}
