"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

export interface RevenueBucket {
  label: string;      // e.g. "1 Aug", "Mon", "9am"
  cents: number;      // revenue in cents for the bucket
}

export interface RevenueSeries {
  month: RevenueBucket[];  // current month, one bucket per day
  week: RevenueBucket[];   // last 7 days, one per day
  day: RevenueBucket[];    // today, one per hour (24 buckets)
}

type Period = keyof RevenueSeries;

interface PeriodOption {
  id: Period;
  label: string;
}

interface BarGeometry {
  index: number;
  label: string;
  cents: number;
  x: number;          // bar left edge, px
  centerX: number;    // slot centre, px
  slotX: number;      // hit-area left edge, px
  slotWidth: number;
  width: number;
  height: number;
  y: number;          // bar top edge, px
  radius: number;
  delayMs: number;
}

interface HoverState {
  index: number;
  label: string;
  cents: number;
  centerX: number;
  barTop: number;
}

const PERIODS: readonly PeriodOption[] = [
  { id: "month", label: "Month" },
  { id: "week", label: "Week" },
  { id: "day", label: "Day" },
];

const CHART_HEIGHT = 240;
const TOP_PADDING = 16;           // keeps the tallest bar off the top gridline
const PLOT_HEIGHT = CHART_HEIGHT - TOP_PADDING;
const FALLBACK_PLOT_WIDTH = 800;  // used for SSR + first paint, corrected on mount
const GRID_FRACTIONS = [1, 2 / 3, 1 / 3, 0] as const;
const TOTAL_STAGGER_MS = 260;     // capped so 31 bars animate as fast as 7
const TOOLTIP_EDGE_MARGIN = 72;

/** Full AUD amount, e.g. 123456 -> "$1,234.56". */
function formatAud(formatter: Intl.NumberFormat, cents: number): string {
  return formatter.format(cents / 100);
}

/** Short axis tick, e.g. 120000 -> "$1.2k". */
function formatAudCompact(cents: number): string {
  const dollars = cents / 100;
  if (Math.abs(dollars) >= 1000) {
    const thousands = dollars / 1000;
    return `$${thousands.toFixed(Math.abs(thousands) >= 10 ? 0 : 1)}k`;
  }
  return `$${Math.round(dollars)}`;
}

function clamp(value: number, lower: number, upper: number): number {
  // Bounds can invert on very narrow containers; centre is the sane fallback.
  if (upper < lower) return (lower + upper) / 2;
  return Math.min(upper, Math.max(lower, value));
}

/** How many buckets to skip between x-axis labels so they never collide. */
function labelStrideFor(period: Period, count: number): number {
  if (period === "week") return 1;
  if (period === "day") return 3;
  return Math.max(1, Math.ceil(count / 6));
}

function subtitleFor(period: Period, monthName: string): string {
  if (period === "week") return "Last 7 days";
  if (period === "day") return "Today by hour";
  return `This month · ${monthName}`;
}

export default function RevenueChart({ series }: { series: RevenueSeries }): React.JSX.Element {
  const [period, setPeriod] = useState<Period>("month");
  const [hover, setHover] = useState<HoverState | null>(null);
  const [plotWidth, setPlotWidth] = useState(FALLBACK_PLOT_WIDTH);
  const plotRef = useRef<HTMLDivElement | null>(null);

  // Unique gradient ids so multiple charts on one page never cross-reference.
  const gradientId = useId().replace(/:/g, "");
  const baseFill = `revenue-bar-${gradientId}`;
  const hotFill = `revenue-bar-hot-${gradientId}`;

  // Measuring the plot lets the SVG use a 1:1 pixel viewBox — nothing stretches.
  useEffect(() => {
    const element = plotRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (width > 0) setPlotWidth(width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }),
    [],
  );
  const monthName = useMemo(
    () => new Date().toLocaleDateString("en-AU", { month: "long" }),
    [],
  );

  const buckets = useMemo<RevenueBucket[]>(() => series[period] ?? [], [series, period]);

  const totalCents = useMemo(
    () => buckets.reduce((sum, bucket) => sum + (Number.isFinite(bucket.cents) ? bucket.cents : 0), 0),
    [buckets],
  );

  // Never zero — every ratio below divides by this.
  const maxCents = useMemo(
    () => Math.max(1, ...buckets.map((bucket) => (Number.isFinite(bucket.cents) ? bucket.cents : 0))),
    [buckets],
  );
  const allZero = useMemo(
    () => buckets.every((bucket) => !Number.isFinite(bucket.cents) || bucket.cents <= 0),
    [buckets],
  );

  const bars = useMemo<BarGeometry[]>(() => {
    const count = buckets.length;
    if (count === 0) return [];
    const slotWidth = plotWidth / count;
    const barWidth = clamp(slotWidth * 0.62, 2, 28);
    return buckets.map((bucket, index) => {
      const cents = Number.isFinite(bucket.cents) ? Math.max(0, bucket.cents) : 0;
      const height = allZero || cents <= 0 ? 2 : Math.max(3, (cents / maxCents) * PLOT_HEIGHT);
      const slotX = index * slotWidth;
      const x = slotX + (slotWidth - barWidth) / 2;
      return {
        index,
        label: bucket.label,
        cents,
        x,
        centerX: slotX + slotWidth / 2,
        slotX,
        slotWidth,
        width: barWidth,
        height,
        y: CHART_HEIGHT - height,
        radius: Math.min(barWidth / 2, 4),
        delayMs: Math.round((index / count) * TOTAL_STAGGER_MS),
      };
    });
  }, [buckets, plotWidth, maxCents, allZero]);

  const ticks = useMemo(
    () =>
      GRID_FRACTIONS.map((fraction) => ({
        fraction,
        y: CHART_HEIGHT - fraction * PLOT_HEIGHT,
        // With no revenue at all, only the baseline gets a label.
        label: allZero ? (fraction === 0 ? "$0" : "") : formatAudCompact(maxCents * fraction),
      })),
    [maxCents, allZero],
  );

  const stride = labelStrideFor(period, buckets.length);
  const subtitle = subtitleFor(period, monthName);
  const formattedTotal = formatAud(currencyFormatter, totalCents);

  const tooltipLeft = hover
    ? clamp(hover.centerX, TOOLTIP_EDGE_MARGIN, plotWidth - TOOLTIP_EDGE_MARGIN)
    : 0;

  return (
    // Chrome-free: the dashboard section supplies the admin-card frame.
    <div className="relative p-5">
      <style>{`
        @keyframes ecl-revenue-rise { from { transform: scaleY(0); } to { transform: scaleY(1); } }
        .ecl-revenue-bar {
          transform-box: view-box;
          animation: ecl-revenue-rise 420ms cubic-bezier(0.22, 1, 0.36, 1) both;
          transition: opacity 160ms ease-out;
        }
        @media (prefers-reduced-motion: reduce) {
          .ecl-revenue-bar { animation-duration: 1ms; animation-delay: 0ms; }
        }
      `}</style>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="text-xs font-medium uppercase tracking-wide text-muted">Revenue</span>
          <div className="mt-1 text-3xl font-semibold tracking-tight text-fg tabular-nums">
            {formattedTotal}
          </div>
          <div className="mt-1 text-xs text-muted-2">{subtitle}</div>
        </div>

        <div className="inline-flex items-center gap-1 rounded-xl border border-line bg-surface p-1">
          {PERIODS.map((option) => {
            const active = option.id === period;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setPeriod(option.id);
                  setHover(null);
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
                  active
                    ? "bg-surface-2 text-fg shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
                    : "text-muted hover:text-fg-2"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <div className="relative w-12 shrink-0" style={{ height: CHART_HEIGHT }}>
          {ticks.map((tick) => (
            <span
              key={tick.fraction}
              className="absolute right-0 -translate-y-1/2 text-[10px] tabular-nums text-muted-2"
              style={{ top: tick.y }}
            >
              {tick.label}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div ref={plotRef} className="relative" style={{ height: CHART_HEIGHT }}>
            <svg
              width="100%"
              height={CHART_HEIGHT}
              viewBox={`0 0 ${plotWidth} ${CHART_HEIGHT}`}
              role="img"
              aria-label={`Revenue chart — ${subtitle}. Total ${formattedTotal} across ${buckets.length} data points.`}
              onMouseLeave={() => setHover(null)}
            >
              <defs>
                <linearGradient id={baseFill} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.92" />
                  <stop offset="55%" stopColor="var(--color-accent-2)" stopOpacity="0.48" />
                  <stop offset="100%" stopColor="var(--color-accent-2)" stopOpacity="0.06" />
                </linearGradient>
                <linearGradient id={hotFill} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="1" />
                  <stop offset="55%" stopColor="var(--color-accent-2)" stopOpacity="0.78" />
                  <stop offset="100%" stopColor="var(--color-accent-2)" stopOpacity="0.18" />
                </linearGradient>
              </defs>

              {ticks.map((tick) => (
                <line
                  key={tick.fraction}
                  x1={0}
                  x2={plotWidth}
                  y1={tick.y}
                  y2={tick.y}
                  stroke="var(--color-line)"
                  strokeWidth={1}
                  opacity={tick.fraction === 0 ? 0.9 : 0.45}
                />
              ))}

              {hover && (
                <line
                  x1={hover.centerX}
                  x2={hover.centerX}
                  y1={TOP_PADDING}
                  y2={CHART_HEIGHT}
                  stroke="var(--color-line-2)"
                  strokeWidth={1}
                  opacity={0.7}
                />
              )}

              {/* Keyed on period so the grow-from-baseline animation replays on switch. */}
              <g key={period}>
                {bars.map((bar) => {
                  const isHovered = hover?.index === bar.index;
                  return (
                    <g key={bar.index}>
                      <rect
                        className="ecl-revenue-bar"
                        x={bar.x}
                        y={bar.y}
                        width={bar.width}
                        height={bar.height}
                        rx={bar.radius}
                        fill={`url(#${isHovered ? hotFill : baseFill})`}
                        opacity={hover && !isHovered ? 0.45 : 1}
                        style={{
                          transformOrigin: `${bar.centerX}px ${CHART_HEIGHT}px`,
                          animationDelay: `${bar.delayMs}ms`,
                        }}
                      />
                      {bar.height >= 6 && (
                        <rect
                          className="ecl-revenue-bar"
                          x={bar.x}
                          y={bar.y}
                          width={bar.width}
                          height={2}
                          rx={1}
                          fill="var(--color-accent)"
                          opacity={hover && !isHovered ? 0.4 : 0.95}
                          style={{
                            transformOrigin: `${bar.centerX}px ${CHART_HEIGHT}px`,
                            animationDelay: `${bar.delayMs}ms`,
                          }}
                        />
                      )}
                    </g>
                  );
                })}
              </g>

              {/* Transparent full-height targets keep even 2px bars hoverable. */}
              {bars.map((bar) => (
                <rect
                  key={`hit-${bar.index}`}
                  x={bar.slotX}
                  y={0}
                  width={bar.slotWidth}
                  height={CHART_HEIGHT}
                  fill="transparent"
                  onMouseEnter={() =>
                    setHover({
                      index: bar.index,
                      label: bar.label,
                      cents: bar.cents,
                      centerX: bar.centerX,
                      barTop: bar.y,
                    })
                  }
                />
              ))}
            </svg>

            {hover && (
              <div
                className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-xl border border-line-2 bg-surface-2 px-3 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
                style={{ left: tooltipLeft, top: Math.max(0, hover.barTop - 10) }}
              >
                <div className="text-[10px] uppercase tracking-wide text-muted-2">{hover.label}</div>
                <div className="mt-0.5 text-sm font-semibold tabular-nums text-fg">
                  {formatAud(currencyFormatter, hover.cents)}
                </div>
              </div>
            )}
          </div>

          {/* Axis labels live in HTML so they never inherit SVG scaling. */}
          <div className="mt-2 flex">
            {bars.map((bar) => {
              const isLast = bar.index === bars.length - 1;
              const nearLast = bars.length - 1 - bar.index < stride / 2;
              const show = isLast || (bar.index % stride === 0 && !nearLast);
              return (
                <div
                  key={`label-${bar.index}`}
                  className={`min-w-0 flex-1 truncate text-center text-[10px] tabular-nums ${
                    hover?.index === bar.index ? "text-fg-2" : "text-muted-2"
                  }`}
                >
                  {show ? bar.label : " "}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
