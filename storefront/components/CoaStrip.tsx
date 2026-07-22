import Link from "next/link";
import type { CoaRecord } from "@/lib/coa";

/** Horizontal "latest batch results" proof strip for the homepage. */
export default function CoaStrip({ records }: { records: CoaRecord[] }) {
  if (records.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-surface p-6 text-sm text-muted">
        Latest batch results are being published — check the{" "}
        <Link href="/lab-results" className="text-accent">
          Lab Results
        </Link>{" "}
        page.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {records.map((r) => (
        <div
          key={r.batch_id}
          className="rounded-lg border border-line bg-surface p-3 transition-colors hover:border-accent/40"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-muted-2">Batch</span>
            <span className="rounded bg-success/15 px-1.5 py-0.5 text-[10px] font-semibold text-success">
              {r.purity_pct.toFixed(2)}%
            </span>
          </div>
          <p className="mt-1 truncate text-sm font-semibold text-fg">{r.compound}</p>
          <p className="font-mono text-[11px] text-muted-2">#{r.batch_id}</p>
          <p className="mt-1 text-[11px] text-muted">{r.lab} · {r.test_date}</p>
        </div>
      ))}
    </div>
  );
}
