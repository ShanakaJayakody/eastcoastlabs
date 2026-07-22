"use client";

import { formatAud } from "@/lib/format";

/**
 * Two-tier reward ladder. One progress bar toward the higher milestone (free
 * gift), with a marker at the free-shipping threshold along the way. The
 * message adapts to which reward is next, which keeps nudging the basket up
 * even after free shipping is unlocked.
 */
export default function FreeShippingProgress({
  subtotal,
  threshold,
  giftThreshold,
}: {
  subtotal: number;
  threshold: number;
  giftThreshold?: number;
}) {
  const hasGiftTier = typeof giftThreshold === "number" && giftThreshold > threshold;
  const max = hasGiftTier ? giftThreshold! : threshold;
  const pct = Math.min(100, Math.round((subtotal / max) * 100));
  const shipMarkerPct = hasGiftTier ? Math.round((threshold / max) * 100) : 100;

  const freeShipping = subtotal >= threshold;
  const giftUnlocked = hasGiftTier && subtotal >= giftThreshold!;

  let message: React.ReactNode;
  if (giftUnlocked) {
    message = (
      <span className="font-medium text-success">🎁 Free shipping + free bacteriostatic water unlocked</span>
    );
  } else if (freeShipping && hasGiftTier) {
    message = (
      <>
        Free shipping unlocked. Add{" "}
        <span className="font-semibold text-fg">{formatAud(giftThreshold! - subtotal)}</span> more for a{" "}
        <span className="font-medium text-accent">free bacteriostatic water 🎁</span>
      </>
    );
  } else if (freeShipping) {
    message = <span className="font-medium text-success">✓ You&apos;ve unlocked free shipping</span>;
  } else {
    message = (
      <>
        You&apos;re <span className="font-semibold text-fg">{formatAud(threshold - subtotal)}</span> from free
        shipping
      </>
    );
  }

  return (
    <div className="rounded-lg border border-line bg-surface/60 p-3">
      <p className="text-sm text-fg-2">{message}</p>
      <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-ink">
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
        {hasGiftTier && (
          <span
            className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 rounded-full bg-line-2"
            style={{ left: `${shipMarkerPct}%` }}
            aria-hidden
          />
        )}
      </div>
      <div className="mt-1 flex items-center justify-between text-[11px] text-muted-2">
        <span>🚚 Free shipping {formatAud(threshold, 0)}</span>
        {hasGiftTier && <span>🎁 Free gift {formatAud(giftThreshold!, 0)}</span>}
      </div>
    </div>
  );
}
