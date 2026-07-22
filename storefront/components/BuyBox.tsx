"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { TierCard } from "@/lib/pricing";
import { formatAud, minorToMajor } from "@/lib/format";
import { useCart } from "@/lib/cart-context";
import { useUI } from "@/lib/ui-context";
import { trackAddToCart } from "@/lib/analytics";

export interface BuyBoxProduct {
  id: number;
  name: string;
  slug: string;
  sku: string;
  image?: string;
}

export interface BacWaterOption {
  id: number;
  name: string;
  price: number; // AUD major units
  image?: string;
}

interface BuyBoxProps {
  product: BuyBoxProduct;
  tiers: TierCard[] | null;
  singlePriceMinor: string;
  minorUnit: number;
  bacWater?: BacWaterOption | null;
}

const RESTOCK_DISCOUNT = 0.1; // save 10% on the restock program
const round2 = (n: number) => Math.round(n * 100) / 100;

export default function BuyBox({ product, tiers, singlePriceMinor, minorUnit, bacWater }: BuyBoxProps) {
  const { addLine } = useCart();
  const { openCart } = useUI();

  const defaultTier = tiers?.find((t) => t.preselected)?.id ?? tiers?.[0]?.id ?? "single";
  const [selected, setSelected] = useState<TierCard["id"]>(defaultTier);
  const [restock, setRestock] = useState(false);
  const [addBac, setAddBac] = useState(false);
  const [showSticky, setShowSticky] = useState(false);

  const atcRef = useRef<HTMLDivElement | null>(null);

  const activeTier = useMemo(
    () => (tiers ? tiers.find((t) => t.id === selected) ?? tiers[0] : null),
    [tiers, selected],
  );

  const baseTotal = activeTier ? activeTier.total : minorToMajor(singlePriceMinor, minorUnit);
  const lineTotal = round2(baseTotal * (1 - (restock ? RESTOCK_DISCOUNT : 0)));
  const variantLabel = activeTier ? activeTier.label : "1 vial";

  // Sticky add-to-cart bar via IntersectionObserver on the primary ATC block.
  useEffect(() => {
    const el = atcRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowSticky(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  function handleAdd() {
    const restockSuffix = restock ? " · Restock (−10%)" : "";
    const key = `${product.id}:${activeTier?.id ?? "single"}:${restock ? "sub" : "once"}`;
    addLine(
      {
        key,
        productId: product.id,
        name: product.name,
        slug: product.slug,
        variantLabel: `${variantLabel}${restockSuffix}`,
        image: product.image,
        unitPrice: lineTotal,
      },
      1,
    );
    trackAddToCart(
      {
        item_id: product.id,
        item_name: product.name,
        item_variant: `${variantLabel}${restockSuffix}`,
        price: lineTotal,
        quantity: 1,
      },
      lineTotal,
    );

    if (addBac && bacWater) {
      addLine(
        {
          key: `${bacWater.id}:single`,
          productId: bacWater.id,
          name: bacWater.name,
          slug: "bacteriostatic-water",
          variantLabel: "1 vial",
          image: bacWater.image,
          unitPrice: bacWater.price,
        },
        1,
      );
    }
    openCart();
  }

  return (
    <div className="space-y-5">
      {/* Tier radio cards */}
      {tiers ? (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-fg">Choose your pack</legend>
          <div className="grid gap-2.5">
            {tiers.map((tier) => {
              const isSel = tier.id === selected;
              return (
                <label
                  key={tier.id}
                  className={`relative flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition-colors ${
                    isSel ? "border-accent bg-accent/5" : "border-line bg-surface hover:border-line-2"
                  }`}
                >
                  <input
                    type="radio"
                    name="tier"
                    value={tier.id}
                    checked={isSel}
                    onChange={() => setSelected(tier.id)}
                    className="sr-only"
                  />
                  <span
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${
                      isSel ? "border-accent" : "border-line-2"
                    }`}
                  >
                    {isSel && <span className="h-2.5 w-2.5 rounded-full bg-accent" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-fg">{tier.label}</span>
                      {tier.badge && (
                        <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
                          {tier.badge}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs">
                      <span className="font-medium text-fg-2">{formatAud(tier.perVial)}/vial</span>
                      {tier.savingLabel && <span className="text-success">{tier.savingLabel}</span>}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-bold text-fg">{formatAud(tier.total)}</div>
                    {tier.strikethrough && tier.strikethrough > tier.total && (
                      <div className="text-xs text-muted-2 line-through">
                        {formatAud(tier.strikethrough)}
                      </div>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : (
        <div className="rounded-xl border border-line bg-surface p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-semibold text-fg">1 vial</span>
            <span className="text-lg font-bold text-fg">
              {formatAud(minorToMajor(singlePriceMinor, minorUnit))}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-2">Pack options coming soon.</p>
        </div>
      )}

      {/* Restock toggle */}
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface p-3.5">
        <input
          type="checkbox"
          checked={restock}
          onChange={(e) => setRestock(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]"
        />
        <span className="text-sm">
          <span className="font-semibold text-fg">Restock program</span>{" "}
          <span className="text-success">+ save 10%</span>
          <span className="mt-0.5 block text-xs text-muted">
            Skip, pause, or cancel anytime. No lock-in.
          </span>
        </span>
      </label>

      {/* Bac-water attach */}
      {bacWater && (
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface p-3.5">
          <input
            type="checkbox"
            checked={addBac}
            onChange={(e) => setAddBac(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]"
          />
          <span className="text-sm">
            <span className="font-semibold text-fg">Add {bacWater.name}</span>{" "}
            <span className="text-fg-2">+{formatAud(bacWater.price)}</span>
            <span className="mt-0.5 block text-xs text-muted">
              Required for reconstitution. Add it now and save a separate order.
            </span>
          </span>
        </label>
      )}

      {/* Add to cart */}
      <div ref={atcRef}>
        <button
          type="button"
          onClick={handleAdd}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 py-4 text-base font-semibold text-accent-ink transition hover:brightness-95"
        >
          Add to Cart · {formatAud(lineTotal)}
        </button>
        {/* Guarantee microcopy */}
        <p className="mt-3 text-center text-xs text-muted">
          🛡️ Purity guaranteed — we cover the test. 1-business-day dispatch.
        </p>
      </div>

      {/* Sticky add-to-cart bar (appears on scroll) */}
      <div
        className={`fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ink/95 backdrop-blur transition-transform duration-300 ${
          showSticky ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-fg">{product.name}</p>
            <p className="text-xs text-muted">
              {variantLabel} · <span className="font-semibold text-fg-2">{formatAud(lineTotal)}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={handleAdd}
            className="shrink-0 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink transition hover:brightness-95"
          >
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}
