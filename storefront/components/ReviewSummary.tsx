import Stars from "./Stars";
import { isSample } from "@/lib/reviews";

/** Inline rating summary: stars + numeric rating + review count. */
export default function ReviewSummary({
  rating,
  count,
  size = 14,
  showSampleTag = false,
  className = "",
}: {
  rating: number;
  count: number;
  size?: number;
  showSampleTag?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <Stars rating={rating} size={size} />
      <span className="text-sm font-semibold text-fg">{rating.toFixed(1)}</span>
      <span className="text-sm text-muted">
        ({count.toLocaleString("en-AU")} review{count === 1 ? "" : "s"})
      </span>
      {showSampleTag && isSample() && (
        <span
          className="rounded-full border border-warn/40 bg-warn/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warn"
          title="Placeholder ratings for layout. Real customer reviews pending before go-live."
        >
          Sample data
        </span>
      )}
    </div>
  );
}
