"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, Download, Loader2, Search, X } from "lucide-react";

/** Presets cover the questions actually asked of an orders list. */
const PRESETS: { label: string; days: number | "mtd" }[] = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "This month", days: "mtd" },
  { label: "90 days", days: 90 },
];

const SEARCH_DEBOUNCE_MS = 300;

const inputClass =
  "rounded-lg border border-line bg-ink-2 px-3 py-1.5 text-sm text-fg outline-none focus:border-accent";

/** Today in Sydney as YYYY-MM-DD, regardless of where the browser is. */
function sydneyToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function shiftDays(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10));
  const next = new Date(Date.UTC(y, m - 1, d + delta));
  return next.toISOString().slice(0, 10);
}

export default function OrdersFilters({
  search,
  from,
  to,
  exportHref,
}: {
  search: string;
  from: string;
  to: string;
  exportHref: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [term, setTerm] = useState(search);
  const [showDates, setShowDates] = useState(Boolean(from || to));
  // The debounce must not fire on mount, or landing on ?q=foo immediately
  // rewrites the URL and fights the back button.
  const mounted = useRef(false);

  // The pending debounce outlives the render that scheduled it, so it must read
  // the query string at fire time. Closing over `params` meant a preset or tab
  // click made mid-typing was silently reverted 300ms later.
  const paramsRef = useRef(params);
  paramsRef.current = params;

  // Resync when the URL changes from anywhere else — Back, a cleared filter, a
  // link. Without this the box shows a term that is no longer being filtered on.
  const [lastSearch, setLastSearch] = useState(search);
  if (lastSearch !== search) {
    setLastSearch(search);
    setTerm(search);
  }

  /** Patch the query string, always resetting to page 1. */
  const push = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(paramsRef.current.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.delete("page");
    const qs = next.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const id = setTimeout(() => {
      if (term.trim() !== (paramsRef.current.get("q") ?? "")) {
        push({ q: term.trim() || null });
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
    // `push` is recreated every render; the term is the only real trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  const applyPreset = (days: number | "mtd") => {
    const today = sydneyToday();
    const start = days === "mtd" ? `${today.slice(0, 7)}-01` : shiftDays(today, -(days - 1));
    setShowDates(true);
    push({ from: start, to: today });
  };

  const clearDates = () => push({ from: null, to: null });
  const hasDates = Boolean(from || to);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search
          size={14}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Order #, email, name"
          aria-label="Search orders"
          className={`${inputClass} w-52 pl-8`}
        />
        {pending && (
          <Loader2
            size={13}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-muted"
          />
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowDates((v) => !v)}
        aria-expanded={showDates}
        className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition ${
          hasDates
            ? "border-accent/40 bg-accent/10 text-accent"
            : "border-line-2 bg-surface text-fg-2 hover:text-fg"
        }`}
      >
        <CalendarDays size={14} />
        {hasDates ? `${from || "start"} → ${to || "today"}` : "Dates"}
      </button>

      {hasDates && (
        <button
          type="button"
          onClick={clearDates}
          aria-label="Clear date filter"
          className="rounded-lg border border-line-2 p-1.5 text-muted transition hover:text-fg"
        >
          <X size={14} />
        </button>
      )}

      <Link
        href={exportHref}
        prefetch={false}
        className="flex items-center gap-1.5 rounded-lg border border-line-2 bg-surface px-3 py-1.5 text-sm text-fg-2 transition hover:text-fg"
      >
        <Download size={14} /> Export
      </Link>

      {showDates && (
        <div className="flex w-full flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => applyPreset(preset.days)}
              className="rounded-full border border-line-2 px-2.5 py-1 text-xs text-muted transition hover:border-accent/40 hover:text-fg-2"
            >
              {preset.label}
            </button>
          ))}
          <span className="mx-1 text-xs text-muted-2">or</span>
          <input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => push({ from: e.target.value || null })}
            aria-label="From date"
            className={`${inputClass} [color-scheme:dark]`}
          />
          <span className="text-xs text-muted-2">→</span>
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => push({ to: e.target.value || null })}
            aria-label="To date"
            className={`${inputClass} [color-scheme:dark]`}
          />
        </div>
      )}
    </div>
  );
}
