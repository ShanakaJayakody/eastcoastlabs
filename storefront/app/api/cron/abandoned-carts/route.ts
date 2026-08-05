import { NextResponse } from "next/server";
import { queueAbandonedCartEmails } from "@/lib/admin/cart-recovery";

export const dynamic = "force-dynamic";

/** Hourly sweep: queues staged recovery emails (+1h/+24h/+72h). Protected by CRON_SECRET. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  const queued = await queueAbandonedCartEmails();
  return NextResponse.json({ queued });
}
