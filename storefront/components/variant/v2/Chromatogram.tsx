/**
 * Decorative schematic chromatogram trace — one dominant peak in laboratory
 * green. Explicitly labelled "indicative" so it never misrepresents itself as
 * the product's actual HPLC-UV output; it is typographic proof-of-category,
 * not a data visualisation.
 */
export default function Chromatogram({ className = "" }: { className?: string }) {
  return (
    <div className={className}>
      <svg viewBox="0 0 280 60" className="h-full w-full" preserveAspectRatio="none" aria-hidden>
        <path
          d="M0 52 L60 51 L88 50 L104 46 L114 10 L124 46 L140 51 L170 50.5 L200 51 L280 50"
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="1.25"
        />
        <line x1="0" y1="54" x2="280" y2="54" stroke="var(--color-line-2)" strokeWidth="0.75" />
      </svg>
      <p className="mt-1 font-data text-[9px] uppercase tracking-[0.1em] text-muted-2">
        HPLC-UV — indicative trace
      </p>
    </div>
  );
}
