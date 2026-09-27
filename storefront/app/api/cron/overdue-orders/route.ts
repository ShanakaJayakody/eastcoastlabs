import { NextResponse } from "next/server";
import { rejectUnauthorizedCron } from "@/lib/cron-auth";
import { recordCronRun } from "@/lib/admin/cron-runs";
import { remindOverdueOrders } from "@/lib/admin/overdue-orders";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const rejected = rejectUnauthorizedCron(request);
  if (rejected) return rejected;
  return NextResponse.json(await recordCronRun("overdue-orders", remindOverdueOrders));
}
