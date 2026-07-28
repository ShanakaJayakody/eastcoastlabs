import type { CoaRecord } from "@/lib/coa";
import CountUp from "./CountUp";

/**
 * "The last six batches" as a document table, not a card grid — columns of
 * evidence rather than decorated tiles. Mobile collapses each row to a
 * stacked two-line block instead of horizontal scroll.
 */
export default function LedgerTable({ records }: { records: CoaRecord[] }) {
  if (records.length === 0) {
    return (
      <p className="border border-line bg-surface p-6 text-sm text-muted">
        Batch results are being published — check the Lab Results page shortly.
      </p>
    );
  }

  return (
    <div className="border border-line bg-surface">
      {/* Header row — desktop only */}
      <div className="hidden grid-cols-[100px_1.4fr_100px_1fr_120px_100px] gap-4 border-b border-line px-5 py-3 font-data text-[11px] uppercase tracking-[0.08em] text-muted-2 sm:grid">
        <span>Batch</span>
        <span>Compound</span>
        <span>Purity</span>
        <span>Lab</span>
        <span>Date</span>
        <span className="text-right">Verify</span>
      </div>

      {records.map((r, i) => (
        <div
          key={r.batch_id}
          className={`grid grid-cols-2 gap-x-4 gap-y-1 px-5 py-4 transition-colors hover:bg-surface-2 sm:grid-cols-[100px_1.4fr_100px_1fr_120px_100px] sm:items-center sm:gap-4 sm:py-3 ${
            i > 0 ? "border-t border-line" : ""
          }`}
        >
          <span className="font-data text-[13px] text-muted-2">#{r.batch_id}</span>
          <span className="font-serif-display order-first text-lg text-fg sm:order-none sm:text-base sm:font-sans">
            {r.compound}
          </span>
          <span className="font-data text-[13px] text-accent">
            <CountUp value={r.purity_pct} decimals={2} suffix="%" />
          </span>
          <span className="text-sm text-fg-2">{r.lab}</span>
          <span className="font-data text-[13px] text-muted">{r.test_date}</span>
          <a
            href={r.lab_verify_url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-data text-[12px] text-accent underline underline-offset-2 sm:text-right"
          >
            Verify ↗
          </a>
        </div>
      ))}
    </div>
  );
}
