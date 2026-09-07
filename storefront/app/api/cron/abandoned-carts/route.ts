import { NextResponse } from "next/server";
import { rejectUnauthorizedCron } from "@/lib/cron-auth";
import { queueAbandonedCartEmails } from "@/lib/admin/cart-recovery";
import { recordCronRun } from "@/lib/admin/cron-runs";

export const dynamic = "force-dynamic";

/** Hourly sweep: queues staged recovery emails (+1h/+24h/+72h). Protected by CRON_SECRET. */
export async function GET(request: Request) {
  const rejected = rejectUnauthorizedCron(request);
  if (rejected) return rejected;
  const result = await recordCronRun("abandoned-carts", async () => ({
    queued: await queueAbandonedCartEmails(),
  }));
  return NextResponse.json(result);
}
