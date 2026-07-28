import Link from "next/link";
import type { Review } from "@/lib/reviews";
import SquareStars from "./SquareStars";

/**
 * 06 / right column. Real published reviews only, typeset as pull-quotes. If
 * fewer than 3 exist, degrades to the aggregate + a link — never pads with
 * invented quotes.
 */
export default function Testimony({
  reviews,
  aggregate,
}: {
  reviews: (Review & { productSlug: string })[];
  aggregate: { rating: number; count: number } | null;
}) {
  const hasEnough = reviews.length >= 3;

  return (
    <div className="flex flex-col justify-between border border-line-2 bg-surface p-6 sm:p-8">
      <div>
        <h2 className="font-serif-display text-2xl text-fg">Testimony</h2>

        {hasEnough ? (
          <div className="mt-6 space-y-6">
            {reviews.map((r, i) => (
              <blockquote key={i} className={i > 0 ? "border-t border-line pt-6" : ""}>
                <SquareStars rating={r.rating} />
                <p className="font-serif-display mt-2.5 text-lg italic leading-snug text-fg">
                  "{r.body}"
                </p>
                <footer className="mt-2 font-data text-[11px] uppercase tracking-wide text-muted-2">
                  — {r.verified ? "Verified buyer" : r.author} · {r.productSlug} ·{" "}
                  {new Date(r.date).toLocaleDateString("en-AU", { month: "short", year: "numeric" })}
                </footer>
              </blockquote>
            ))}
          </div>
        ) : aggregate ? (
          <div className="mt-6">
            <SquareStars rating={aggregate.rating} size={11} />
            <p className="mt-2 text-sm text-muted">
              {aggregate.rating.toFixed(1)} average across {aggregate.count} published review
              {aggregate.count === 1 ? "" : "s"}.
            </p>
          </div>
        ) : (
          <p className="mt-6 text-sm text-muted">
            Reviews are collected after verified purchase and published without editing.
          </p>
        )}
      </div>

      <Link href="/shop" className="mt-8 font-data text-[12px] uppercase tracking-wide text-accent underline underline-offset-2">
        Read all reviews →
      </Link>
    </div>
  );
}
