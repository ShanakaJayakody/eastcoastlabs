/**
 * Rating display for the Dossier system — five small squares (not the round
 * star glyph used on the control site), fractionally filled in laboratory
 * green. Reads like a measurement scale, not a five-star review widget.
 */
export default function SquareStars({
  rating,
  size = 8,
  className = "",
}: {
  rating: number;
  size?: number;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, (rating / 5) * 100));
  return (
    <span
      className={`relative inline-flex gap-[3px] align-middle ${className}`}
      role="img"
      aria-label={`${rating.toFixed(1)} out of 5`}
    >
      <span className="inline-flex gap-[3px]">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            style={{ width: size, height: size, background: "var(--color-line-2)" }}
          />
        ))}
      </span>
      <span className="absolute inset-0 inline-flex gap-[3px] overflow-hidden" style={{ width: `${pct}%` }} aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="shrink-0"
            style={{ width: size, height: size, background: "var(--color-accent)" }}
          />
        ))}
      </span>
    </span>
  );
}
