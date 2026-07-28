"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Mobile-only sticky shop bar. Appears after the hero scrolls out so it never
 * competes with the primary hero CTA on first paint.
 */
export default function StickyCta() {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const onScroll = () => setShown(window.scrollY > 620);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={`pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line-2 bg-ink/97 px-4 py-3 backdrop-blur transition-transform duration-300 md:hidden ${
        shown ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-data text-[11px] uppercase tracking-wide text-fg">Batch-verified</p>
          <p className="truncate text-[11px] text-muted">Free shipping over $150 · AU dispatch</p>
        </div>
        <Link
          href="/shop"
          className="shrink-0 border border-fg bg-fg px-5 py-2.5 font-data text-[12px] font-medium uppercase tracking-wide text-ink"
        >
          Browse catalog
        </Link>
      </div>
    </div>
  );
}
