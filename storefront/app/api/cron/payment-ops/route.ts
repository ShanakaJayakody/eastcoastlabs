import { NextResponse } from "next/server";
import { remindUnpaidOrders, expireUnpaidOrders } from "@/lib/admin/payment-ops";

export const dynamic = "force-dynamic";

/**
 * Unpaid-order sweep: nudge, then release.
 *
 * Reminders run before expiry so an order that has earned both a final reminder
 * and cancellation in the same pass gets cancelled, not nagged then cancelled
 * — remindUnpaidOrders skips anything already past its expiry.
 *
 * Both halves are idempotent, so running this more often only makes reminders
 * more punctual. Note the Vercel Hobby plan caps crons at once daily; on Pro,
 * drop this to hourly so the 4h reminder actually lands near 4h.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const reminders = await remindUnpaidOrders();
  const expiries = await expireUnpaidOrders();

  return NextResponse.json({ ...reminders, ...expiries });
}
