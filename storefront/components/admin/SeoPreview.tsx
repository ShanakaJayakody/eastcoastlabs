"use client";

/**
 * Google-style snippet preview with length meters. Admins can't otherwise tell
 * whether a title/description will truncate in search results.
 */
const TITLE_MAX = 60;
const DESC_MAX = 155;

function Meter({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, (value / max) * 100);
  const over = value > max;
  return (
    <span className="flex items-center gap-2">
      <span className="h-1 w-16 overflow-hidden rounded-full bg-line">
        <span
          className={`block h-full rounded-full transition-all ${over ? "bg-warn" : "bg-accent"}`}
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className={`text-[11px] ${over ? "text-warn" : "text-muted-2"}`}>
        {value}/{max}
      </span>
    </span>
  );
}

export default function SeoPreview({
  title,
  description,
  slug,
  fallbackTitle,
}: {
  title: string;
  description: string;
  slug: string;
  fallbackTitle: string;
}) {
  const shownTitle = title || fallbackTitle;
  const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-line bg-ink-2 p-3">
        <p className="text-[11px] uppercase tracking-wide text-muted-2">Google preview</p>
        <div className="mt-2">
          <p className="text-xs text-muted">eastcoastlabs.com.au › product › {slug}</p>
          <p className="mt-0.5 text-[15px] leading-snug text-accent-2">
            {truncate(shownTitle, TITLE_MAX)}
          </p>
          <p className="mt-0.5 text-xs leading-snug text-muted">
            {description ? truncate(description, DESC_MAX) : "No meta description set — Google will pick text from the page."}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-4">
        <span className="flex items-center gap-2 text-xs text-muted">
          Title <Meter value={title.length} max={TITLE_MAX} />
        </span>
        <span className="flex items-center gap-2 text-xs text-muted">
          Description <Meter value={description.length} max={DESC_MAX} />
        </span>
      </div>
    </div>
  );
}
