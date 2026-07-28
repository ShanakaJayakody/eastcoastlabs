import type { CoaRecord } from "@/lib/coa";

/**
 * Full-bleed marquee of every published batch. Pure CSS animation (no JS),
 * duplicated once so the loop is seamless; pauses on hover for readability.
 * The duplicate set is aria-hidden so screen readers see the list once.
 */
export default function BatchTicker({ records }: { records: CoaRecord[] }) {
  if (records.length === 0) return null;

  const Item = ({ r }: { r: CoaRecord }) => (
    <span className="whitespace-nowrap px-6 font-data text-[13px] text-fg-2">
      BATCH {r.batch_id} — {r.compound.toUpperCase()} — {r.purity_pct.toFixed(2)}% — {r.test_date}
      <span className="ml-6 text-line-2">///</span>
    </span>
  );

  return (
    <div className="overflow-hidden border-y border-line bg-ink-2 py-3">
      <div className="ticker-track">
        <div className="flex">
          {records.map((r) => (
            <Item key={r.batch_id} r={r} />
          ))}
        </div>
        <div className="flex" aria-hidden="true">
          {records.map((r) => (
            <Item key={`dup-${r.batch_id}`} r={r} />
          ))}
        </div>
      </div>
    </div>
  );
}
