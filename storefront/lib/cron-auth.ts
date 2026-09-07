import "server-only";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

/** Returns a response on rejection; callers must return it before doing any work. */
export function rejectUnauthorizedCron(request: Request): Response | null {
  const secret = process.env.CRON_SECRET;
  if (!secret?.trim()) return NextResponse.json({ error: "Cron is not configured" }, { status: 503 });
  const supplied = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
