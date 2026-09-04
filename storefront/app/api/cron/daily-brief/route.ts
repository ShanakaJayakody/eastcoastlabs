import { NextResponse } from "next/server";
import { Resend } from "resend";
import {
  buildDailyBrief,
  renderDailyBrief,
  briefRecipients,
  briefAlreadySent,
  markBriefSent,
} from "@/lib/admin/daily-brief";
import { recordCronRun } from "@/lib/admin/cron-runs";

export const dynamic = "force-dynamic";

const FROM = process.env.RESEND_FROM_EMAIL || "East Coast Labs <orders@eastcoastlabs.com.au>";

/**
 * The morning brief to every active admin.
 *
 * Scheduled at 21:00 UTC because Vercel cron only speaks UTC: that is 7am in
 * Sydney on standard time and 8am on daylight time. Splitting the difference
 * beats drifting into the middle of the night, and the brief covers whole
 * calendar days so the hour it lands does not change its contents.
 *
 * Sent directly rather than through the outbox: the outbox is the customer
 * mail queue, and an internal note that is a day late is worse than useless.
 *
 * `?dry=1` renders the brief and returns it as JSON without sending, so the
 * content can be checked without waiting for tomorrow morning.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const dry = url.searchParams.get("dry") === "1";

  // Unlike the sweep crons, this endpoint returns revenue, profit and the admin
  // roster, and can send mail on demand. It refuses to run unauthenticated
  // rather than falling open when CRON_SECRET happens to be unset.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const brief = await buildDailyBrief();
  const { subject, html } = renderDailyBrief(brief);

  if (dry) {
    return NextResponse.json({
      dry: true,
      date: brief.date,
      subject,
      recipients: await briefRecipients(),
      counts: brief.queue.counts,
      nudges: brief.nudges.map((n) => n.headline),
      html,
    });
  }

  const result = await recordCronRun("daily-brief", async () => {
    // Vercel cron is at-least-once, so a retry must not deliver a second copy.
    if (await briefAlreadySent(brief.date)) {
      return { sent: 0, reason: "already sent", date: brief.date };
    }

    const recipients = await briefRecipients();
    if (recipients.length === 0) return { sent: 0, reason: "no active admins" };

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return { sent: 0, reason: "RESEND_API_KEY not configured" };

    const resend = new Resend(apiKey);
    const failed: string[] = [];
    for (const to of recipients) {
      const { error } = await resend.emails.send({ from: FROM, to, subject, html });
      if (error) failed.push(`${to}: ${error.message}`);
    }

    const sent = recipients.length - failed.length;
    if (sent > 0) await markBriefSent(brief.date, sent);
    return { sent, failed, date: brief.date };
  });
  return NextResponse.json(result);
}
