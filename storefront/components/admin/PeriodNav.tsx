import Link from "next/link";
import { ChevronLeft, ChevronRight, Undo2 } from "lucide-react";
import type { RevenueScale, WindowMeta } from "@/lib/admin/order-queries";

const SCALES: { id: RevenueScale; label: string }[] = [
  { id: "month", label: "Month" },
  { id: "week", label: "Week" },
  { id: "day", label: "Day" },
];

/**
 * Period stepper for server-rendered pages.
 *
 * The revenue chart has its own client-side version because it swaps data in
 * place; here every change is a full navigation anyway, so plain links are
 * simpler, shareable and work without JavaScript. Both read the same
 * `windowMeta`, so "August" means the same span on both screens.
 */
export default function PeriodNav({
  meta,
  hrefFor,
}: {
  meta: WindowMeta;
  /** Serializable on purpose — a callback cannot cross into a client component. */
  hrefFor: (scale: RevenueScale, anchor: string | null) => string;
}) {
  const nav =
    "flex h-7 w-7 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-fg";
  const pill = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
      active ? "bg-surface-2 text-fg shadow-[0_1px_2px_rgba(0,0,0,0.35)]" : "text-muted hover:text-fg-2"
    }`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div>
        <div className="text-sm font-medium text-fg">{meta.title}</div>
        <div className="text-xs text-muted-2">{meta.hint}</div>
      </div>

      <div className="ml-auto inline-flex items-center gap-0.5 rounded-xl border border-line bg-surface p-1">
        <Link
          href={hrefFor(meta.scale, meta.prevAnchor)}
          aria-label={`Previous ${meta.scale}`}
          className={nav}
        >
          <ChevronLeft size={16} />
        </Link>
        {!meta.isCurrent && (
          <Link
            href={hrefFor(meta.scale, null)}
            className="flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-medium text-accent-2 transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <Undo2 size={13} /> Now
          </Link>
        )}
        {meta.nextAnchor ? (
          <Link href={hrefFor(meta.scale, meta.nextAnchor)} aria-label={`Next ${meta.scale}`} className={nav}>
            <ChevronRight size={16} />
          </Link>
        ) : (
          <span
            aria-disabled
            title="Already at the current period"
            className={`${nav} cursor-not-allowed opacity-30`}
          >
            <ChevronRight size={16} />
          </span>
        )}
      </div>

      <div className="inline-flex items-center gap-1 rounded-xl border border-line bg-surface p-1">
        {SCALES.map((option) => (
          <Link
            key={option.id}
            href={hrefFor(option.id, meta.isCurrent ? null : meta.anchor)}
            className={pill(option.id === meta.scale)}
          >
            {option.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
