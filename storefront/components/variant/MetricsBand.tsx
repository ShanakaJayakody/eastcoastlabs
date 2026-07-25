/**
 * Quantified-proof band (Renue's "Measured Success" pattern).
 *
 * DELIBERATE CONSTRAINT: every figure here is COMPUTED from real data the store
 * already holds — published COA rows, their measured purity, the live catalog —
 * or is a policy the business already states publicly. No business-scale claims
 * ("orders shipped", "years trading", "customers served") are rendered, because
 * we cannot substantiate them. Add those only when the owner supplies real
 * numbers.
 */
export interface Metric {
  value: string;
  label: string;
  sub?: string;
}

export default function MetricsBand({ metrics }: { metrics: Metric[] }) {
  if (metrics.length === 0) return null;

  return (
    <div className="rounded-2xl border border-line bg-surface px-6 py-10 sm:px-10">
      <div className="grid gap-8 text-center sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <div key={m.label}>
            <p className="text-4xl font-bold tracking-tight text-accent tabular-nums">{m.value}</p>
            <p className="mt-2 text-sm font-semibold text-fg">{m.label}</p>
            {m.sub && <p className="mt-1 text-xs text-muted">{m.sub}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
