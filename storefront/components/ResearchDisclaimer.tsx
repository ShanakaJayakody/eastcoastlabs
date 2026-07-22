/** The mandatory research-use-only line. Rendered on PDP, cart, and footer. */
export const RUO_TEXT = "Research use only — not for human or animal consumption.";

export default function ResearchDisclaimer({
  className = "",
  variant = "inline",
}: {
  className?: string;
  variant?: "inline" | "badge";
}) {
  if (variant === "badge") {
    return (
      <div
        className={`inline-flex items-center gap-2 rounded-md border border-warn/30 bg-warn/10 px-3 py-1.5 text-xs font-medium text-warn ${className}`}
      >
        <span aria-hidden>⚠</span>
        <span>{RUO_TEXT}</span>
      </div>
    );
  }
  return <p className={`text-xs text-muted-2 ${className}`}>{RUO_TEXT}</p>;
}
