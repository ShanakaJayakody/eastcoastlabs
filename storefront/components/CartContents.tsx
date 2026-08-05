"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useCart } from "@/lib/cart-context";
import { formatAud } from "@/lib/format";
import FreeShippingProgress from "./FreeShippingProgress";
import CartUpsell from "./CartUpsell";
import ResearchDisclaimer from "./ResearchDisclaimer";

const GIFT_KEY = "gift:bac-water";

export default function CartContents({ onNavigate }: { onNavigate?: () => void }) {
  const {
    lines,
    subtotal,
    itemCount,
    updateQty,
    removeLine,
    addLine,
    goToCheckout,
    freeShippingThreshold,
    giftThreshold,
    ready,
  } = useCart();

  // Free bacteriostatic-water gift once the basket clears the gift threshold.
  // The gift line is $0 so it never affects the threshold check itself.
  const giftLine = lines.find((l) => l.key === GIFT_KEY);
  const hasGift = !!giftLine;
  const giftEligible = subtotal >= giftThreshold;
  useEffect(() => {
    // The gift is always exactly one unit — clamp if a stale line drifted.
    if (giftLine && giftLine.quantity !== 1) {
      updateQty(GIFT_KEY, 1);
      return;
    }
    if (giftEligible && !hasGift) {
      addLine({
        key: GIFT_KEY,
        productId: 990101,
        name: "Bacteriostatic Water",
        slug: "bacteriostatic-water",
        variantLabel: "🎁 Free gift",
        unitPrice: 0,
      });
    } else if (!giftEligible && hasGift) {
      removeLine(GIFT_KEY);
    }
  }, [giftEligible, hasGift, giftLine, addLine, removeLine, updateQty]);

  if (ready && lines.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full border border-line bg-surface text-2xl">
          🧪
        </div>
        <p className="text-fg-2">Your cart is empty.</p>
        <Link
          href="/shop"
          onClick={onNavigate}
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:brightness-95"
        >
          Browse research peptides
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <FreeShippingProgress
          subtotal={subtotal}
          threshold={freeShippingThreshold}
          giftThreshold={giftThreshold}
        />

        <ul className="space-y-3">
          {lines.map((line) => (
            <li key={line.key} className="flex gap-3 rounded-lg border border-line bg-surface/60 p-3">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-line bg-ink">
                {line.image ? (
                  <Image src={line.image} alt={line.name} fill sizes="64px" className="object-contain p-1" />
                ) : (
                  <div className="grid h-full w-full place-items-center text-xl">🧪</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={`/product/${line.slug}`}
                      onClick={onNavigate}
                      className="block truncate text-sm font-semibold text-fg hover:text-accent"
                    >
                      {line.name}
                    </Link>
                    <p className="text-xs text-muted">{line.variantLabel}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLine(line.key)}
                    className="-m-2 p-2 text-xs text-muted-2 hover:text-warn"
                    aria-label={`Remove ${line.name}`}
                  >
                    Remove
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  {line.key === GIFT_KEY ? (
                    <span className="text-xs font-medium text-success">Included free</span>
                  ) : (
                  <div className="inline-flex items-center rounded-md border border-line">
                    <button
                      type="button"
                      onClick={() => updateQty(line.key, line.quantity - 1)}
                      className="btn-press grid h-10 w-10 place-items-center text-base text-fg-2 hover:text-fg"
                      aria-label="Decrease quantity"
                    >
                      –
                    </button>
                    <span className="w-8 text-center text-sm text-fg">{line.quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateQty(line.key, line.quantity + 1)}
                      className="btn-press grid h-10 w-10 place-items-center text-base text-fg-2 hover:text-fg"
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>
                  )}
                  <span className="text-sm font-semibold text-fg">
                    {formatAud(line.unitPrice * line.quantity)}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <CartUpsell />
      </div>

      <div className="pb-safe space-y-3 border-t border-line bg-ink-2 px-4 py-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">Subtotal ({itemCount} {itemCount === 1 ? "item" : "items"})</span>
          <span className="text-base font-bold text-fg">{formatAud(subtotal)}</span>
        </div>
        <p className="text-[11px] text-muted-2">
          Shipping &amp; taxes calculated at checkout. You&apos;ll see &quot;EAST COAST LABS&quot; on
          your statement.
        </p>
        <button
          type="button"
          onClick={goToCheckout}
          disabled={lines.length === 0}
          className="w-full rounded-md bg-accent px-4 py-3 text-sm font-semibold text-accent-ink transition hover:brightness-95 disabled:opacity-50"
        >
          Checkout →
        </button>
        <p className="text-center text-[11px] text-muted-2">
          Secure checkout on eastcoastlabs.com.au
        </p>
        <ResearchDisclaimer className="text-center" />
      </div>
    </div>
  );
}
