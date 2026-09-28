"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { reservedVials } from "@/lib/cart-line";
import type { TierCard } from "@/lib/pricing";
import { formatAud, minorToMajor } from "@/lib/format";
import { useCart } from "@/lib/cart-context";
import { useUI } from "@/lib/ui-context";
import { commerceItem, trackAddToCart, trackSelectPack } from "@/lib/analytics";
import { cartContainsProduct, isGiftEligible } from "@/lib/cart-offers";
import PurchaseReassurance from './PurchaseReassurance';

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
  available: number;
  bacWater?: BacWaterOption | null;
  sizeLabel?: string;
  cartKeyPrefix?: string;
  analyticsSlug?: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export default function BuyBox({ product, tiers, singlePriceMinor, minorUnit, bacWater, available, sizeLabel, cartKeyPrefix, analyticsSlug }: BuyBoxProps) {
  const { addLine, stockFor, lines, subtotal, giftThreshold } = useCart();
  const { openCart, cartOpen } = useUI();

  const remaining = Math.max(0, available - reservedVials(lines, product.slug));
  const defaultTier = tiers?.find(t => t.preselected && t.vials <= remaining)?.id ?? tiers?.find(t => t.vials <= remaining)?.id ?? "single";
  const [selected, setSelected] = useState<TierCard["id"]>(defaultTier);
  const [addBac, setAddBac] = useState(false);
  const [qty, setQty] = useState(1);
  const [stickyPosition, setStickyPosition] = useState<'before' | 'after' | null>(null);

  const atcRef = useRef<HTMLButtonElement | null>(null);
  const optionsRef = useRef<HTMLDivElement | null>(null);
  const showSticky = stickyPosition !== null && !cartOpen;

  const activeTier = useMemo(
    () => (tiers ? tiers.find((t) => t.id === selected) ?? tiers[0] : null),
    [tiers, selected],
  );

  const baseTotal = activeTier ? activeTier.total : minorToMajor(singlePriceMinor, minorUnit);
  const lineTotal = round2(baseTotal);
  const maxQty = Math.min(99, Math.floor(remaining / (activeTier?.vials ?? 1)));
  const canAdd = qty <= maxQty && maxQty > 0;
  const variantLabel = `${activeTier ? activeTier.label : "1 vial"}${sizeLabel ? ` · ${sizeLabel}` : ''}`;
  const waterInBasket = cartContainsProduct(lines, 'bacteriostatic-water');
  const selectedQualifiesForGift = Boolean(bacWater) && isGiftEligible({
    subtotalCents: Math.round((subtotal + lineTotal * qty) * 100),
    thresholdCents: Math.round(giftThreshold * 100),
    available: stockFor('bacteriostatic-water'),
    hasPaidItems: true,
  });

  // Track the actual button: a visible total does not make the action reachable.
  useEffect(() => {
    const el = atcRef.current;
    if (!el) return;
    let frame = 0;
    const refresh = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      if (!rect.height) return;
      const header = document.querySelector('header');
      const position = header && getComputedStyle(header).position;
      const top = header && (position === 'sticky' || position === 'fixed')
        ? Math.max(0, header.getBoundingClientRect().bottom) : 0;
      setStickyPosition(rect.top < top ? 'after' : rect.bottom > window.innerHeight ? 'before' : null);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(refresh); };
    // Scroll also covers instant anchor jumps that never intersect the button.
    window.addEventListener('scroll', schedule, {passive:true});
    window.addEventListener('resize', schedule);
    const observer = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(schedule, {threshold:1}) : null;
    observer?.observe(el);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, []);

  function handleAdd() {
    if (!canAdd) return;
    const key = `${cartKeyPrefix ?? product.id}:${activeTier?.id ?? "single"}:once`;
    addLine(
      {
        key,
        productId: product.id,
        name: product.name,
        slug: product.slug,
        variantLabel: variantLabel,
        image: product.image,
        unitPrice: lineTotal,
      },
      qty,
      activeTier?.vials ?? 1,
    );
    trackAddToCart(commerceItem({
      slug: analyticsSlug ?? product.slug,
      name: product.name,
      size: sizeLabel,
      pack: activeTier?.label ?? '1 vial',
      price: lineTotal,
      quantity: qty,
    }), lineTotal * qty);

    if (addBac && bacWater && (stockFor("bacteriostatic-water") ?? 1) > 0) {
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
    <div ref={optionsRef} tabIndex={-1} aria-label="Purchase options" className="ecl-purchase-options space-y-3 scroll-mt-28 outline-none focus-visible:ring-2 focus-visible:ring-accent">
      {/* Tier radio cards */}
      {tiers ? (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-fg">Choose your pack</legend>
          <div className="grid gap-2">
            {tiers.map((tier) => {
              const isSel = tier.id === selected;
              return (
                <label
                  key={tier.id}
                  className={`relative flex cursor-pointer flex-wrap items-center gap-3 rounded-xl border p-3 transition-colors focus-within:ring-2 focus-within:ring-accent ${
                    isSel ? "border-accent bg-accent/5" : "border-line bg-surface hover:border-line-2"
                  }`}
                >
                  <input
                    type="radio"
                    name="tier"
                    value={tier.id}
                    checked={isSel}
                    disabled={tier.vials > remaining}
                    onChange={() => {
                      setSelected(tier.id);
                      setQty(1);
                      trackSelectPack(commerceItem({
                        slug: analyticsSlug ?? product.slug,
                        name: product.name,
                        size: sizeLabel,
                        pack: tier.label,
                        price: tier.total,
                        quantity: 1,
                      }));
                    }}
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
                          {/most popular/i.test(tier.badge) ? `${tier.vials} vials` : tier.badge}
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

        </div>
      )}

      {bacWater && selectedQualifiesForGift && !waterInBasket && (
        <p className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-xs text-success">
          This selected pack qualifies for an included bacteriostatic water vial. Final eligibility is confirmed after discounts at checkout.
        </p>
      )}
      {bacWater && waterInBasket && (
        <p className="rounded-lg border border-line bg-surface px-3 py-2 text-xs text-muted">
          Your basket already includes bacteriostatic water. You can still add an extra vial below.
        </p>
      )}

      {/* Bac-water attach — hidden when the ledger says bac water is gone,
          so the PDP never invites an add that checkout would refuse. */}
      {bacWater && (waterInBasket || !selectedQualifiesForGift) && (stockFor("bacteriostatic-water") ?? 1) > 0 && (
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface p-3.5">
          <input
            type="checkbox"
            checked={addBac}
            onChange={(e) => setAddBac(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]"
          />
          <span className="text-sm">
            <span className="font-semibold text-fg">{waterInBasket ? 'Add an extra' : 'Add'} {bacWater.name}</span>{" "}
            <span className="text-fg-2">+{formatAud(bacWater.price)}</span>
            <span className="mt-0.5 block text-xs text-muted">
              Research accessory. Add to the same shipment.
            </span>
          </span>
        </label>
      )}

      {/* Add to cart */}
      <div>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-2">Selected total</span>
          <span className="text-lg font-bold text-fg">{formatAud(lineTotal * qty)}</span>
        </div>
        <div className="flex items-stretch gap-2.5">
          <div className="inline-flex shrink-0 items-center rounded-xl border border-line bg-surface">
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              disabled={qty <= 1}
              className="btn-press grid h-full w-11 place-items-center text-lg text-fg-2 transition hover:text-fg disabled:opacity-40"
              aria-label="Decrease quantity"
            >
              –
            </button>
            <span className="w-8 text-center text-sm font-semibold text-fg" aria-live="polite">
              {qty}
            </span>
            <button
              type="button"
              onClick={() => setQty((q) => Math.min(99, q + 1))}
              disabled={qty >= maxQty}
              className="btn-press grid h-full w-11 place-items-center text-lg text-fg-2 transition hover:text-fg disabled:opacity-40"
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>
          <button
            ref={atcRef}
            type="button"
            onClick={handleAdd}
            disabled={!canAdd}
            className="btn-press flex min-w-0 flex-1 flex-wrap items-center justify-center gap-2 rounded-xl bg-accent px-5 py-4 text-base font-semibold text-accent-ink transition hover:brightness-95"
          >
            Add to Cart · {formatAud(lineTotal * qty)}
          </button>
        </div>
        {/* Guarantee microcopy */}
        <p className="mt-3 text-center text-xs text-muted">
          Dispatch follows payment confirmation. Check available batch documentation before ordering.
        </p>
      </div>

      <PurchaseReassurance />

      {/* Sticky add-to-cart bar (appears on scroll) */}
      <div
        role="region"
        aria-label="Quick purchase"
        hidden={!showSticky}
        inert={!showSticky}
        aria-hidden={!showSticky}
        className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ink/95 backdrop-blur"
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-fg">{product.name}</p>
            <p className="text-xs text-muted">
              {variantLabel}
              {qty > 1 && ` × ${qty}`} ·{" "}
              <span className="font-semibold text-fg-2">{formatAud(lineTotal * qty)}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (stickyPosition === 'before') {
                const options = optionsRef.current?.closest<HTMLElement>('[data-purchase-options]') ?? optionsRef.current;
                options?.scrollIntoView?.({block:'start', behavior:'instant'});
                options?.focus({preventScroll:true});
              } else handleAdd();
            }}
            disabled={stickyPosition === 'after' && !canAdd}
            className="btn-press min-h-11 shrink-0 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink transition hover:brightness-95 disabled:opacity-50"
          >
            {stickyPosition === 'before' ? 'Choose options' : 'Add to Cart'}
          </button>
        </div>
      </div>
    </div>
  );
}
