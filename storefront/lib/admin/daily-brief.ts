/**
 * The morning brief.
 *
 * The dashboard answers "what needs me?" only once someone opens it. This is
 * the same answer, pushed each morning: yesterday's money against the same
 * weekday a week ago, the work waiting, and anything anomalous. It lands at
 * 07:00 Sydney on standard time and 08:00 on daylight time, because Vercel
 * cron schedules are UTC only.
 *
 * Same-weekday comparison is deliberate. A Saturday against a Friday tells you
 * nothing; a Saturday against last Saturday tells you whether the week moved.
 */
import "server-only";
import { adminDb } from "./db";
import {
  revenueWindow,
  sydneyDayBoundary,
  sydneyDayKey,
  type RevenueTotals,
} from "./order-queries";
import { attentionQueue, anomalyNudges, type AttentionQueue, type Nudge } from "./attention";

export interface DailyBrief {
  /** Sydney calendar date the brief covers. */
  date: string;
  yesterday: RevenueTotals;
  sameDayLastWeek: RevenueTotals;
  orderCount: number;
  queue: AttentionQueue;
  nudges: Nudge[];
}

const aud = (cents: number | null): string =>
  cents==null?"Unknown":new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(cents / 100);

function shiftSydneyDay(key: string, days: number): string {
  const [y, m, d] = key.split("-").map((n) => parseInt(n, 10));
  return sydneyDayKey(new Date(Date.UTC(y, m - 1, d + days, 2, 0, 0)));
}

export async function buildDailyBrief(): Promise<DailyBrief> {
  const today = sydneyDayKey(new Date());
  const date = shiftSydneyDay(today, -1);

  const [yesterdayWindow, lastWeekWindow, queue, nudges] = await Promise.all([
    revenueWindow({ scale: "day", anchor: date }),
    revenueWindow({ scale: "day", anchor: shiftSydneyDay(date, -7) }),
    attentionQueue(12),
    anomalyNudges(),
  ]);

  // Bounds come from the same offset-probing helper the chart uses. Hardcoding
  // +10:00 would be an hour out for half the year, quietly counting one day's
  // late-evening orders into the next.
  const dayStart = sydneyDayBoundary(date);
  const dayEnd = sydneyDayBoundary(date, true);
  let countQuery = adminDb()
    .from("orders")
    .select("*", { count: "exact", head: true })
    .not("paid_at", "is", null);
  if (dayStart) countQuery = countQuery.gte("paid_at", dayStart);
  if (dayEnd) countQuery = countQuery.lt("paid_at", dayEnd);
  const { count, error } = await countQuery;
  if(error)throw new Error(`Daily brief orders: ${error.message}`);

  return {
    date,
    yesterday: yesterdayWindow.totals,
    sameDayLastWeek: lastWeekWindow.totals,
    orderCount: count ?? 0,
    queue,
    nudges,
  };
}

function deltaText(current: number, previous: number): string {
  if (previous === 0) {
    return current > 0 ? "nothing on the same day last week to compare" : "same as last week";
  }
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  return `${pct >= 0 ? "▲" : "▼"} ${Math.abs(pct).toFixed(0)}% vs the same day last week`;
}

/** Plain, table-free HTML — this is read on a phone at 7am, not admired. */
export function renderDailyBrief(brief: DailyBrief): { subject: string; html: string } {
  const { yesterday, sameDayLastWeek, queue, nudges } = brief;
  // Midday avoids any offset ambiguity when formatting the label.
  const pretty = new Date(`${brief.date}T12:00:00Z`).toLocaleDateString("en-AU", {
    timeZone: "Australia/Sydney",
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const work = [
    queue.counts.payment && `${queue.counts.payment} awaiting payment`,
    queue.counts.fulfil && `${queue.counts.fulfil} to pack`,
    queue.counts.review && `${queue.counts.review} review${queue.counts.review === 1 ? "" : "s"} to moderate`,
    queue.counts.restock && `${queue.counts.restock} out of stock with people waiting`,
  ].filter(Boolean) as string[];

  const escape = (text: string): string =>
    text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const nudgeHtml = nudges.length
    ? `<h3 style="margin:24px 0 8px;font-size:15px">Worth a look</h3>${nudges
        .map(
          (n) =>
            `<p style="margin:0 0 10px"><strong>${escape(n.headline)}</strong><br><span style="color:#666">${escape(n.detail)}</span></p>`,
        )
        .join("")}`
    : "";

  const subject =
    yesterday.revenueCents > 0
      ? `${aud(yesterday.revenueCents)} yesterday · ${work.length ? work[0] : "nothing waiting"}`
      : `No sales yesterday · ${work.length ? work[0] : "nothing waiting"}`;

  const html = `
<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;color:#111;line-height:1.5">
  <p style="color:#666;margin:0 0 4px;font-size:13px">${escape(pretty)}</p>
  <h2 style="margin:0 0 4px;font-size:22px">${aud(yesterday.revenueCents)}</h2>
  <p style="margin:0 0 2px;color:#666;font-size:13px">
    ${brief.orderCount} order${brief.orderCount === 1 ? "" : "s"} · ${escape(deltaText(yesterday.revenueCents, sameDayLastWeek.revenueCents))}
  </p>
  <p style="margin:0 0 16px;color:#666;font-size:13px">
    Gross profit ${aud(yesterday.profitCents)}${
      yesterday.uncostedLines > 0
        ? ` <span style="color:#a60">(unknown — ${yesterday.uncostedLines} line${yesterday.uncostedLines === 1 ? "" : "s"} without a recorded cost)</span>`
        : ""
    }${yesterday.refundedCents > 0 ? ` · ${aud(yesterday.refundedCents)} refunded` : ""}
  </p>

  <h3 style="margin:0 0 8px;font-size:15px">Waiting for you</h3>
  ${
    work.length
      ? `<ul style="margin:0 0 8px;padding-left:18px">${work.map((w) => `<li>${escape(w)}</li>`).join("")}</ul>`
      : `<p style="margin:0 0 8px;color:#666">Nothing — everything is packed, confirmed and moderated.</p>`
  }
  ${nudgeHtml}

  <p style="margin:24px 0 0">
    <a href="https://www.eastcoastlabs.com.au/admin" style="color:#0a7">Open the dashboard →</a>
  </p>
</div>`.trim();

  return { subject, html };
}

/** Active admins are the recipients — no separate list to drift out of date. */
export async function briefRecipients(): Promise<string[]> {
  const { data, error } = await adminDb().from("admin_users").select("email").eq("active", true);
  if (error) throw new Error(`Cannot read daily brief recipients: ${error.message}`);
  return (data ?? []).map((r) => r.email as string);
}
