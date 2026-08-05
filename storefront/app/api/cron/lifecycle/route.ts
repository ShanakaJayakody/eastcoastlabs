import { NextResponse } from "next/server";
import {
  sweepWelcomeSeries,
  sweepPostPurchase,
  sweepReplenishment,
  sweepWinback,
  sweepSecondPurchaseNudge,
} from "@/lib/admin/lifecycle";

export const dynamic = "force-dynamic";

/**
 * Daily marketing lifecycle sweep. Every sweep is idempotent (outbox dedupe +
 * eligibility windows), so re-runs and overlaps are harmless. Protected by
 * CRON_SECRET like the other cron routes.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const [welcome, postPurchase, replenishment, winback, nudge] = [
    await sweepWelcomeSeries(),
    await sweepPostPurchase(),
    await sweepReplenishment(),
    await sweepWinback(),
    await sweepSecondPurchaseNudge(),
  ];

  return NextResponse.json({
    welcome: welcome.queued,
    postPurchase: postPurchase.queued,
    replenishment: replenishment.queued,
    winback: winback.queued,
    secondPurchaseNudge: nudge.queued,
  });
}
