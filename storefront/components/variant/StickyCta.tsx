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
      className={`pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur transition-transform duration-300 md:hidden ${
        shown ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-fg">Every batch COA-verified</p>
          <p className="truncate text-[11px] text-muted">Free shipping over $150 · AU dispatch</p>
        </div>
        <Link
          href="/shop"
          className="btn-press shrink-0 rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-accent-ink"
        >
          Shop peptides
        </Link>
      </div>
    </div>
  );
}
