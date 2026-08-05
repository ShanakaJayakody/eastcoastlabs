"use client";

import { useMemo } from "react";
import { useCart } from "@/lib/cart-context";
import { formatAud } from "@/lib/format";
import { isPeptideSlug } from "@/lib/bumps";

export interface BumpProduct {
  id: number;
  name: string;
  slug: string;
  price: number; // AUD major units
  icon?: string;
  blurb?: string;
  unit?: string;
  /** Shown when this is the reconstitution-critical item. */
  essential?: boolean;
}

/**
 * The checkout-page order bump.
 *
 * The cart drawer already suggests accessories, but a shopper who went straight
 * to checkout never saw it — and this is the last moment where adding a $10
 * item costs them nothing extra in shipping or a second order.
 *
 * Deliberately restrained: at most two suggestions, the essential one first.
 * A wall of add-ons at the payment step reads as a shakedown and costs more in
 * abandonment than it earns in attach rate.
 */
export default function CheckoutBump({ products }: { products: BumpProduct[] }) {
  const { lines, addLine } = useCart();

  const inCart = useMemo(() => new Set(lines.map((l) => l.slug)), [lines]);
  // Accessories are only relevant next to a compound. An accessories-only
  // basket gets no bump at all.
  const hasPeptide = useMemo(() => lines.some((l) => isPeptideSlug(l.slug)), [lines]);
  // Never suggest something already in the basket — a bump for an item the
  // shopper just added reads as broken.
  const suggestions = products.filter((p) => !inCart.has(p.slug)).slice(0, 2);
  if (!hasPeptide || suggestions.length === 0) return null;

  return (
    <section className="rounded-xl border border-dashed border-accent/40 bg-accent/[0.03] p-5">
      <h2 className="text-sm font-semibold text-fg">Add research essentials</h2>
      <p className="mt-1 text-xs text-muted">
        Ships in the same parcel — no extra postage.
      </p>

      <ul className="mt-3 space-y-2">
        {suggestions.map((p) => (
          <li
            key={p.slug}
            className="flex items-center gap-3 rounded-lg border border-line bg-ink-2 p-3"
          >
            <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-line bg-surface text-lg">
              {p.icon ?? "🧪"}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-fg">{p.name}</span>
                {p.essential && (
                  <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
                    Required for reconstitution
                  </span>
                )}
              </div>
              {p.blurb && <p className="truncate text-xs text-muted">{p.blurb}</p>}
            </div>
            <button
              type="button"
              onClick={() =>
                addLine(
                  {
                    key: `${p.id}:single`,
                    productId: p.id,
                    name: p.name,
                    slug: p.slug,
                    variantLabel: p.unit ?? "1 vial",
                    unitPrice: p.price,
                  },
                  1,
                )
              }
              className="btn-press shrink-0 rounded-lg border border-accent/50 px-3 py-2 text-xs font-semibold text-accent transition hover:bg-accent hover:text-accent-ink"
            >
              + Add {formatAud(p.price)}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
