/**
 * Star rating display. Renders a 0..5 rating with fractional fill using a
 * clipped overlay, so 4.8 shows as 4.8 stars' worth of gold. Server-safe.
 */

function StarPath() {
  return (
    <path d="M12 2.5l2.9 5.88 6.49.94-4.7 4.58 1.11 6.46L12 17.77 6.2 20.84l1.11-6.46-4.7-4.58 6.49-.94L12 2.5z" />
  );
}

export default function Stars({
  rating,
  size = 14,
  className = "",
}: {
  rating: number;
  size?: number;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, (rating / 5) * 100));
  const stars = [0, 1, 2, 3, 4];
  return (
    <span
      className={`relative inline-flex align-middle ${className}`}
      role="img"
      aria-label={`${rating.toFixed(1)} out of 5 stars`}
      style={{ lineHeight: 0 }}
    >
      {/* empty track */}
      <span className="inline-flex text-line-2">
        {stars.map((i) => (
          <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <StarPath />
          </svg>
        ))}
      </span>
      {/* filled overlay */}
      <span
        className="absolute inset-0 inline-flex overflow-hidden text-[#f5b301]"
        style={{ width: `${pct}%` }}
        aria-hidden
      >
        {stars.map((i) => (
          <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
            <StarPath />
          </svg>
        ))}
      </span>
    </span>
  );
}
