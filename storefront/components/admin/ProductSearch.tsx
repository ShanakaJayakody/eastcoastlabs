"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";

/**
 * Live catalogue search. Typing rewrites `?q=` after a short pause instead of
 * making the operator find and press a Search button — the old flow cost a
 * round trip per keystroke-batch AND a click.
 */
export default function ProductSearch({ initial }: { initial: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initial);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // The debounce must not fire on mount, or every page load would replace the
  // URL with the value it already has.
  const mounted = useRef(false);
  // Read params at fire time, not at render time, so a filter tab clicked mid-
  // typing isn't clobbered by a stale snapshot.
  const paramsRef = useRef(searchParams);
  paramsRef.current = searchParams;

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const id = setTimeout(() => {
      const next = new URLSearchParams(paramsRef.current.toString());
      const q = value.trim();
      if (q) next.set("q", q);
      else next.delete("q");
      const qs = next.toString();
      start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    }, 250);
    return () => clearTimeout(id);
  }, [value, pathname, router]);

  // Keep in step with the URL when something else changes it (Clear filters,
  // back button) — but never yank text out from under someone mid-type.
  useEffect(() => {
    if (document.activeElement !== inputRef.current) setValue(initial);
  }, [initial]);

  // "/" jumps to search, the way every catalogue tool the operator already uses
  // behaves. Ignored while typing somewhere else so it can't eat a slash.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey) return;
      const el = document.activeElement;
      const typing =
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement ||
        (el instanceof HTMLElement && el.isContentEditable);
      if (typing) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="relative">
      <Search
        size={15}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
      />
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && setValue("")}
        placeholder="Search name or SKU"
        aria-label="Search products"
        className="w-full rounded-lg border border-line bg-ink-2 py-1.5 pl-9 pr-8 text-sm text-fg outline-none transition focus:border-accent sm:w-56"
      />
      {pending ? (
        <Loader2
          size={14}
          className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted"
        />
      ) : (
        value && (
          <button
            onClick={() => {
              setValue("");
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-fg"
          >
            <X size={14} />
          </button>
        )
      )}
    </div>
  );
}
