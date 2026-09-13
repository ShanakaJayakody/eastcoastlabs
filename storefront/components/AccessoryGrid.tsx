"use client";

import Image from "next/image";
import { getAccessories } from "@/lib/accessories";
import { useCart } from "@/lib/cart-context";
import { useUI } from "@/lib/ui-context";
import { formatAud } from "@/lib/format";
import { trackAddToCart } from "@/lib/analytics";

/** Shoppable accessories grid (shop page). One-tap add to cart. */
export default function AccessoryGrid() {
  const { addLine, stockFor, priceFor } = useCart();
  const { openCart } = useUI();
  const accessories = getAccessories();

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {accessories.map((a) => {
        // Sold-out accessories stay visible but can't be added; slugs the
        // ledger doesn't track yet (stockFor → null) behave as in stock.
        const inStock = (stockFor(a.slug) ?? 0) > 0;
        const price = priceFor(a.slug) ?? a.price;
        return (
        <div key={a.slug} className="card-hover flex flex-col overflow-hidden rounded-xl border border-line bg-surface hover:border-accent/40">
          <div className="relative aspect-square overflow-hidden bg-ink-2">
            <Image
              src={a.image}
              alt={a.imageAlt}
              fill
              unoptimized
              sizes="(max-width: 640px) 50vw, 25vw"
              className="object-contain p-3"
            />
          </div>
          <div className="flex flex-1 flex-col p-4">
            <p className="text-sm font-semibold text-fg">{a.name}</p>
            <p className="mt-0.5 text-xs text-muted">{a.blurb}</p>
            <div className="mt-auto flex items-center justify-between pt-3">
              <span className="text-sm font-semibold text-fg">{formatAud(price)}</span>
              {!inStock ? (
                <span className="rounded-md border border-line px-3 py-1.5 text-xs font-semibold text-muted-2">
                  Out of stock
                </span>
              ) : (
              <button
                type="button"
                onClick={() => {
                  addLine({
                    key: `acc:${a.slug}`,
                    productId: a.id,
                    name: a.name,
                    slug: a.slug,
                    variantLabel: a.unit,
                    unitPrice: price,
                  });
                  trackAddToCart(
                    { item_id: a.id, item_name: a.name, item_variant: "accessory", price, quantity: 1 },
                    price,
                  );
                  openCart();
                }}
                className="btn-press rounded-md border border-accent/50 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent/20"
              >
                + Add
              </button>
              )}
            </div>
          </div>
        </div>
        );
      })}
    </div>
  );
}
