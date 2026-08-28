"use client";

import { getAccessories } from "@/lib/accessories";
import { useCart } from "@/lib/cart-context";
import { formatAud } from "@/lib/format";
import { trackAddToCart } from "@/lib/analytics";

/**
 * In-cart cross-sell. Surfaces the research accessories a peptide buyer almost
 * always needs (syringes, swabs, sharps). One tap adds them — the cheapest,
 * highest-attach basket lift available.
 */
export default function CartUpsell() {
  const { lines, addLine, stockFor } = useCart();

  const inCart = new Set(lines.map((l) => l.key));
  const suggestions = getAccessories()
    .filter((a) => !inCart.has(`acc:${a.slug}`))
    // Out-of-stock accessories are never suggested; slugs the ledger doesn't
    // track yet (stockFor → null) stay offered.
    .filter((a) => (stockFor(a.slug) ?? 1) > 0)
    .slice(0, 3);

  if (suggestions.length === 0) return null;

  return (
    <div className="rounded-lg border border-line bg-surface/40 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-2">
        Add research essentials
      </p>
      <ul className="space-y-2">
        {suggestions.map((a) => (
          <li key={a.slug} className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-line bg-ink text-lg">
              {a.icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-fg">{a.name}</p>
              <p className="truncate text-[11px] text-muted">{a.blurb}</p>
            </div>
            <span className="shrink-0 text-sm font-semibold text-fg-2">{formatAud(a.price)}</span>
            <button
              type="button"
              onClick={() => {
                addLine({
                  key: `acc:${a.slug}`,
                  productId: a.id,
                  name: a.name,
                  slug: a.slug,
                  variantLabel: a.unit,
                  unitPrice: a.price,
                });
                trackAddToCart(
                  { item_id: a.id, item_name: a.name, item_variant: "accessory", price: a.price, quantity: 1 },
                  a.price,
                );
              }}
              className="btn-press shrink-0 rounded-md border border-accent/50 bg-accent/10 px-2.5 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent/20"
              aria-label={`Add ${a.name}`}
            >
              + Add
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
