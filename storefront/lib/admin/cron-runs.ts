/**
 * Cron run history — did the sweeps actually run, and did they work?
 *
 * Vercel cron is fire-and-forget. Without a record, a job that silently stopped
 * firing looks exactly like a job with nothing to do, and the first symptom is
 * a customer asking why they never got their receipt.
 */
import "server-only";
import { adminDb } from "./db";

export const CRON_JOBS = [
  { job: "email-outbox", label: "Email outbox", schedule: "daily" },
  { job: "lifecycle", label: "Lifecycle sweeps", schedule: "daily" },
  { job: "abandoned-carts", label: "Cart recovery", schedule: "daily" },
  { job: "payment-ops", label: "Unpaid orders", schedule: "daily" },
  { job: "daily-brief", label: "Daily brief", schedule: "daily" },
] as const;

/** A daily job that has not run in this long is overdue, allowing for drift. */
const OVERDUE_HOURS = 30;

export interface CronRun {
  job: string;
  status: "ok" | "failed";
  detail: Record<string, unknown>;
  error: string | null;
  duration_ms: number | null;
  created_at: string;
}

export interface CronHealth {
  job: string;
  label: string;
  schedule: string;
  last: CronRun | null;
  /** Hours since the last run, or null if it has never run. */
  ageHours: number | null;
  state: "ok" | "failed" | "overdue" | "never";
}

/**
 * Wrap a cron body so every invocation is recorded, including the failures.
 *
 * A job that throws is exactly the one worth knowing about, so the error is
 * written before it is re-thrown.
 */
export async function recordCronRun<T extends Record<string, unknown>>(
  job: string,
  work: () => Promise<T>,
): Promise<T> {
  const started = Date.now();
  try {
    const detail = await work();
    await write(job, "ok", detail, null, Date.now() - started);
    return detail;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await write(job, "failed", {}, message, Date.now() - started);
    throw err;
  }
}

async function write(
  job: string,
  status: "ok" | "failed",
  detail: Record<string, unknown>,
  error: string | null,
  durationMs: number,
): Promise<void> {
  // Never let bookkeeping break the job it is recording.
  try {
    await adminDb().from("cron_runs").insert({
      job,
      status,
      detail,
      error,
      duration_ms: durationMs,
    });
  } catch {
    // Swallowed deliberately: the sweep's own result matters more than the log.
  }
}

/** Latest run per job, with a verdict. */
export async function cronHealth(): Promise<CronHealth[]> {
  const { data } = await adminDb()
    .from("cron_runs")
    .select("job, status, detail, error, duration_ms, created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  const latest = new Map<string, CronRun>();
  for (const row of (data ?? []) as CronRun[]) {
    if (!latest.has(row.job)) latest.set(row.job, row);
  }

  const now = Date.now();
  return CRON_JOBS.map(({ job, label, schedule }) => {
    const last = latest.get(job) ?? null;
    // Clamped: the database clock and this one differ by milliseconds, which
    // would otherwise render a fresh run as "-0.00h ago".
    const ageHours = last
      ? Math.max(0, (now - new Date(last.created_at).getTime()) / 3_600_000)
      : null;
    const state: CronHealth["state"] = !last
      ? "never"
      : last.status === "failed"
        ? "failed"
        : ageHours != null && ageHours > OVERDUE_HOURS
          ? "overdue"
          : "ok";
    return { job, label, schedule, last, ageHours, state };
  });
}
