"use client";

import { getAccessories } from "@/lib/accessories";
import { useCart } from "@/lib/cart-context";
import { useUI } from "@/lib/ui-context";
import { formatAud } from "@/lib/format";
import { trackAddToCart } from "@/lib/analytics";

/** Shoppable accessories grid (shop page). One-tap add to cart. */
export default function AccessoryGrid() {
  const { addLine } = useCart();
  const { openCart } = useUI();
  const accessories = getAccessories();

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {accessories.map((a) => (
        <div key={a.slug} className="card-hover flex flex-col rounded-xl border border-line bg-surface p-4 hover:border-accent/40">
          <span className="grid h-12 w-12 place-items-center rounded-lg border border-line bg-ink text-2xl">
            {a.icon}
          </span>
          <p className="mt-3 text-sm font-semibold text-fg">{a.name}</p>
          <p className="mt-0.5 text-xs text-muted">{a.blurb}</p>
          <div className="mt-auto flex items-center justify-between pt-3">
            <span className="text-sm font-semibold text-fg">{formatAud(a.price)}</span>
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
                openCart();
              }}
              className="btn-press rounded-md border border-accent/50 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent/20"
            >
              + Add
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
