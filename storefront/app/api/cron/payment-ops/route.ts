import { NextResponse } from "next/server";
import { rejectUnauthorizedCron } from "@/lib/cron-auth";
import { remindUnpaidOrders, warnExpiringOrders, expireUnpaidOrders } from "@/lib/admin/payment-ops";
import { recordCronRun } from "@/lib/admin/cron-runs";

export const dynamic = "force-dynamic";

/**
 * Unpaid-order sweep: nudge, then release.
 *
 * Order matters: staged reminders, then the final expiry warning, then the
 * release. An order that has earned both a warning and cancellation in the same
 * pass gets cancelled rather than warned-then-killed, because warnExpiringOrders
 * only looks at orders whose expiry is still in the future.
 *
 * Both halves are idempotent, so running this more often only makes reminders
 * more punctual. Note the Vercel Hobby plan caps crons at once daily; on Pro,
 * drop this to hourly so the 4h reminder actually lands near 4h.
 */
export async function GET(request: Request) {
  const rejected = rejectUnauthorizedCron(request);
  if (rejected) return rejected;

  const result = await recordCronRun("payment-ops", async () => {
    const reminders = await remindUnpaidOrders();
    const warnings = await warnExpiringOrders();
    const expiries = await expireUnpaidOrders();
    return { ...reminders, ...warnings, ...expiries };
  });
  return NextResponse.json(result);
}
