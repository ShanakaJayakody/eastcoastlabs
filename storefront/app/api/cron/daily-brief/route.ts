import { NextResponse } from "next/server";
import { buildDailyBrief, renderDailyBrief, briefRecipients } from "@/lib/admin/daily-brief";
import { recordCronRun } from "@/lib/admin/cron-runs";
import { queueEmail } from "@/lib/admin/email";
import { rejectUnauthorizedCron } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

// Uses one durable notification per date and recipient; partial retries cannot duplicate other recipients.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const dry = url.searchParams.get("dry") === "1";

  const rejected = rejectUnauthorizedCron(request);
  if (rejected) return rejected;

  // Built inside the recorder below for the real send. The dry path builds its
  // own copy because it returns before any run is recorded.
  if (dry) {
    const brief = await buildDailyBrief();
    const { subject, html } = renderDailyBrief(brief);
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
    // Inside the wrapper: assembling the brief is the multi-table aggregation
    // most likely to break, and a failure there is exactly what the run log
    // exists to capture.
    const brief = await buildDailyBrief();
    const { subject, html } = renderDailyBrief(brief);

    const recipients = await briefRecipients();
    let queued=0;
    for (const to of recipients) {
      if(await queueEmail({to,template:"admin_daily_brief",payload:{subject,html},relatedType:"daily_brief",relatedId:brief.date}))queued++;
    }
    return { queued,date:brief.date,recipients:recipients.length };
  });
  return NextResponse.json(result);
}
