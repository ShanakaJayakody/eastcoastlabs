/**
 * The oxide-red verification stamp — the page's one deliberate flourish.
 * Pure SVG, rotated via a wrapper so the ring/text stay geometrically correct.
 * Used exactly twice on the page (certificate + contract panel), by design:
 * scarcity is what makes it read as authoritative rather than decorative.
 */
export default function StampSeal({ size = 64, className = "" }: { size?: number; className?: string }) {
  const id = "stamp-arc";
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={`stamp-seal ${className}`}
      style={{ color: "var(--color-accent-2)" }}
      aria-hidden
    >
      <defs>
        <path id={id} d="M 50 50 m -38 0 a 38 38 0 1 1 76 0 a 38 38 0 1 1 -76 0" />
      </defs>
      <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" strokeWidth="1" />
      <text fontSize="8.2" fontWeight="600" letterSpacing="1.5" fill="currentColor">
        <textPath href={`#${id}`} startOffset="2%">
          VERIFIED · JANOSHIK · ECL ·
        </textPath>
      </text>
      <path
        d="M35 52 L45 62 L67 38"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
