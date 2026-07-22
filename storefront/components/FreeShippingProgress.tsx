"use client";

import { formatAud } from "@/lib/format";

export default function FreeShippingProgress({
  subtotal,
  threshold,
}: {
  subtotal: number;
  threshold: number;
}) {
  const pct = Math.min(100, Math.round((subtotal / threshold) * 100));
  const remaining = Math.max(0, threshold - subtotal);
  const unlocked = remaining === 0;

  return (
    <div className="rounded-lg border border-line bg-surface/60 p-3">
      <p className="text-sm text-fg-2">
        {unlocked ? (
          <span className="font-medium text-success">✓ You&apos;ve unlocked free shipping</span>
        ) : (
          <>
            You&apos;re <span className="font-semibold text-fg">{formatAud(remaining)}</span> from free
            shipping
          </>
        )}
      </p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink">
        <div
          className="h-full rounded-full bg-accent transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-[11px] text-muted-2">Free shipping on orders over {formatAud(threshold, 0)}</p>
    </div>
  );
}
