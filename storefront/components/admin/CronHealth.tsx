import { Suspense } from "react";
import { cronHealth, type CronHealth as CronHealthRow } from "@/lib/admin/cron-runs";
import Badge from "./Badge";
import { Bar } from "./Skeleton";

const STATE: Record<CronHealthRow["state"], { tone: "success" | "warn" | "danger" | "neutral"; label: string }> = {
  ok: { tone: "success", label: "ran" },
  overdue: { tone: "warn", label: "overdue" },
  failed: { tone: "danger", label: "failed" },
  never: { tone: "neutral", label: "never run" },
};

function ago(hours: number | null): string {
  if (hours == null) return "—";
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m ago`;
  if (hours < 48) return `${Math.round(hours)}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** Compact render of whatever the job counted, e.g. "sent 12 · failed 0". */
function detailText(detail: Record<string, unknown>): string {
  const parts = Object.entries(detail)
    .filter(([, v]) => typeof v === "number" || typeof v === "string")
    .slice(0, 4)
    .map(([k, v]) => `${k} ${v}`);
  return parts.join(" · ");
}

async function Rows() {
  const jobs = await cronHealth();
  const neverRun = jobs.filter((j) => j.state === "never").length;

  return (
    <>
      <div className="divide-y divide-line">
        {jobs.map((job) => {
          const state = STATE[job.state];
          return (
            <div key={job.job} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <div className="text-fg-2">{job.label}</div>
                <div className="truncate text-xs text-muted">
                  {job.last
                    ? job.last.error
                      ? job.last.error
                      : detailText(job.last.detail) || "nothing to do"
                    : `scheduled ${job.schedule} — no run recorded yet`}
                </div>
              </div>
              <span className="text-xs tabular-nums text-muted-2">{ago(job.ageHours)}</span>
              <Badge tone={state.tone}>{state.label}</Badge>
            </div>
          );
        })}
      </div>

      {neverRun > 0 && (
        <p className="border-t border-line px-4 py-2.5 text-xs text-muted">
          A job shows &ldquo;never run&rdquo; until its next scheduled firing — history starts from
          when this record was added, not from when the job did.
        </p>
      )}
    </>
  );
}

/**
 * Are the scheduled jobs actually running?
 *
 * Vercel cron reports nothing back, so a sweep that quietly stopped firing is
 * indistinguishable from one with no work to do — until a customer asks why
 * their receipt never arrived.
 */
export default function CronHealth() {
  return (
    <section className="admin-card rounded-xl">
      <div className="border-b border-line px-4 py-3">
        <h3 className="text-sm font-semibold text-fg">Scheduled jobs</h3>
        <p className="mt-0.5 text-xs text-muted">
          Vercel runs these daily. Nothing else reports whether they worked.
        </p>
      </div>
      <Suspense
        fallback={
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Bar key={i} className="h-8 w-full" />
            ))}
          </div>
        }
      >
        <Rows />
      </Suspense>
    </section>
  );
}
