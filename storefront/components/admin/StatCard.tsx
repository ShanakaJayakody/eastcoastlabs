import type { LucideIcon } from "lucide-react";

/** Tiny inline trend line. Deliberately axis-free — it answers "which way, and
 *  how steadily", and the tile's `sub` line says what is being counted. */
function Sparkline({ points }: { points: number[] }) {
  const width = 64;
  const height = 18;
  if (points.length < 2) return null;

  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = max - min || 1;
  const step = width / (points.length - 1);
  const coords = points.map((value, i) => {
    const x = i * step;
    // A flat series sits on the midline rather than pinning to the floor.
    const y = max === min ? height / 2 : height - ((value - min) / span) * height;
    return [x, y] as const;
  });
  const path = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [lastX, lastY] = coords[coords.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
      aria-hidden
    >
      <path
        d={path}
        fill="none"
        stroke="var(--color-accent-2)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.85}
      />
      <circle cx={lastX} cy={lastY} r={2} fill="var(--color-accent)" />
    </svg>
  );
}

/**
 * Dashboard KPI tile. `interactive` adds the hover-lift affordance for tiles
 * that are wrapped in a Link — non-clickable tiles stay still.
 *
 * `series` and `delta` are optional on purpose: several of these counts are
 * queue *depths*, and nothing records how deep a queue was last Tuesday. A tile
 * without real history gets no trend line rather than a fabricated one.
 */
export default function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  interactive = false,
  tone = "default",
  series,
  delta,
  invertDelta = false,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: LucideIcon;
  interactive?: boolean;
  tone?: "default" | "accent" | "warn";
  /** Real per-day counts, oldest first. Omit when no history exists. */
  series?: number[];
  /** Ratio change over the series' second half vs its first. */
  delta?: number | null;
  /** Set on queues where growth is bad — unpaid orders, abandoned carts. */
  invertDelta?: boolean;
}) {
  const iconTone =
    tone === "accent"
      ? "bg-accent/10 text-accent"
      : tone === "warn"
        ? "bg-warn/10 text-warn"
        : "bg-surface-2 text-muted";

  const deltaGood = delta == null ? null : invertDelta ? delta <= 0 : delta >= 0;
  const deltaTone = deltaGood == null ? "" : deltaGood ? "text-success" : "text-red-400";

  return (
    <div
      className={`admin-card rounded-xl p-4 ${interactive ? "admin-card-hover cursor-pointer" : ""}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">
          {label}
        </span>
        {Icon && (
          <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${iconTone}`}>
            <Icon size={14} />
          </span>
        )}
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold tabular-nums text-fg">{value}</span>
          {delta != null && (
            <span className={`text-[11px] font-medium tabular-nums ${deltaTone}`}>
              {delta >= 0 ? "▲" : "▼"}
              {Math.abs(delta * 100).toFixed(0)}%
            </span>
          )}
        </div>
        {series && series.length > 1 && <Sparkline points={series} />}
      </div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </div>
  );
}
