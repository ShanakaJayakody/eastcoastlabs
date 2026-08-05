"use client";

import { useState } from "react";
import EmailCapture from "./EmailCapture";
import type { ComingSoonProduct } from "@/lib/coming-soon";

/**
 * The coming-soon shelf.
 *
 * Two jobs. Publicly it stops the catalog looking thin beside competitors
 * carrying 25-150 SKUs. Internally every signup writes to stock_notifications,
 * so the shelf doubles as a demand meter that says which compound to source
 * next — ECL's own customers voting, rather than an inference from what
 * competitors happen to stock.
 *
 * Deliberately NOT ProductCard: these have no price, no stock, and no add-to-cart,
 * and reusing the buy-flow card would invite exactly the "why can't I buy this"
 * confusion the badge exists to prevent.
 */
export default function ComingSoonShelf({ products }: { products: ComingSoonProduct[] }) {
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [joined, setJoined] = useState<Set<string>>(new Set());

  if (!products.length) return null;

  return (
    <section className="mt-16">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            In the pipeline
          </p>
          <h2 className="mt-2 text-2xl font-bold text-fg">Coming soon</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Compounds we&apos;re bringing in next. Tell us which ones you want and we&apos;ll
            prioritise them — you&apos;ll get one email the day it lands, with the batch COA
            published as always.
          </p>
        </div>
      </div>

      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => {
          const isOpen = openSlug === p.slug;
          const hasJoined = joined.has(p.slug);
          return (
            <li
              key={p.slug}
              className="flex flex-col rounded-xl border border-line bg-surface/60 p-4 transition-colors hover:border-line-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-fg">{p.name}</h3>
                  {p.format && (
                    <p className="mt-0.5 font-mono text-xs text-muted-2">{p.format} vial</p>
                  )}
                </div>
                <span className="shrink-0 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
                  Coming soon
                </span>
              </div>

              {p.shortDescription && (
                <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted">
                  {p.shortDescription}
                </p>
              )}

              <div className="mt-3 border-t border-line pt-3">
                {hasJoined ? (
                  <p className="text-xs font-medium text-success">
                    ✓ We&apos;ll email you when {p.name} lands.
                  </p>
                ) : isOpen ? (
                  <EmailCapture
                    source={`back_in_stock:${p.slug}`}
                    cta="Notify me"
                    successMsg={`✓ We'll email you when ${p.name} lands.`}
                    onDone={() => setJoined((s) => new Set(s).add(p.slug))}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setOpenSlug(p.slug)}
                    className="btn-press w-full rounded-lg border border-accent/50 px-3 py-2 text-xs font-semibold text-accent transition hover:bg-accent hover:text-accent-ink"
                  >
                    Notify me when it lands
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-5 text-xs text-muted-2">
        Research use only — not for human or animal consumption. Listings here are not yet
        available to purchase.
      </p>
    </section>
  );
}
