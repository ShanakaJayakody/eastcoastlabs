import Stars from "./Stars";
import ReviewSummary from "./ReviewSummary";
import { getProductReviews, verifiedLabel, isSample } from "@/lib/reviews";

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

/** Ratings distribution bar (share of the aggregate implied by detailed reviews). */
export default function ReviewSection({ slug }: { slug: string }) {
  const data = getProductReviews(slug);
  if (!data || !data.count) return null;

  const label = verifiedLabel();

  return (
    <section className="mt-14">
      <h2 className="mb-5 text-lg font-semibold text-fg">Customer reviews</h2>

      <div className="grid gap-6 rounded-2xl border border-line bg-surface p-6 sm:grid-cols-[auto,1fr] sm:items-center">
        <div className="text-center sm:pr-6">
          <div className="text-4xl font-bold text-fg">{data.rating.toFixed(1)}</div>
          <Stars rating={data.rating} size={18} className="mt-1" />
          <div className="mt-1 text-xs text-muted">
            {data.count.toLocaleString("en-AU")} reviews
          </div>
        </div>
        <div className="border-t border-line pt-4 text-sm text-muted sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
          <p>
            Every reviewer is a {label.toLowerCase()}. We publish ratings alongside the
            independent COA for each batch — quality claims you can check, not just read.
          </p>
          {isSample() && (
            <p className="mt-2 text-xs text-warn">
              ⚠ Sample ratings shown for layout. Real, verified customer reviews will be
              imported before launch.
            </p>
          )}
        </div>
      </div>

      {data.reviews.length > 0 && (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {data.reviews.map((r, i) => (
            <li key={i} className="rounded-xl border border-line bg-surface p-5">
              <div className="flex items-center justify-between gap-2">
                <Stars rating={r.rating} size={13} />
                {r.verified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success/12 px-2 py-0.5 text-[10px] font-semibold text-success">
                    ✓ {label}
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm font-semibold text-fg">{r.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{r.body}</p>
              <p className="mt-3 text-xs text-muted-2">
                {r.author}
                {r.location ? ` · ${r.location}` : ""} · {formatDate(r.date)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
