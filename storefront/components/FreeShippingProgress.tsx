"use client";

import { formatAud } from "@/lib/format";

/** Show the next available reward while keeping every earned milestone visible. */
export default function FreeShippingProgress({
  subtotal,
  threshold,
  giftThreshold,
  expressThreshold,
}: {
  subtotal: number;
  threshold: number;
  giftThreshold?: number;
  expressThreshold?: number;
}) {
  const tiers = [
    { id: "standard", label: "Free standard shipping", threshold },
    { id: "gift", label: "Free bacteriostatic water", threshold: giftThreshold },
    { id: "express", label: "Free Express shipping", threshold: expressThreshold },
  ].flatMap(tier => typeof tier.threshold === "number" && Number.isFinite(tier.threshold) && tier.threshold >= 0
    ? [{ ...tier, cents: Math.round(tier.threshold * 100) }] : [])
    .sort((a, b) => a.cents - b.cents);
  if (!tiers.length) return null;

  const subtotalCents = Number.isFinite(subtotal) ? Math.max(0, Math.round(subtotal * 100)) : 0;
  const next = tiers.find(tier => subtotalCents < tier.cents);
  const maxCents = Math.max(1, tiers[tiers.length - 1].cents);
  const columns = { gridTemplateColumns: "repeat(" + tiers.length + ", minmax(0, 1fr))" };
  const message = next
    ? formatAud((next.cents - subtotalCents) / 100) + " away from " + next.label.replace(/^Free/, "free")
    : "All available rewards unlocked";

  return (
    <section aria-label="Cart rewards" className="rounded-lg border border-line bg-surface/60 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Your cart rewards</p>
      <p role="status" aria-atomic="true" className="mt-1 text-sm font-semibold text-fg">{message}</p>
      <div
        role="progressbar"
        aria-label="Progress toward cart rewards"
        aria-valuemin={0}
        aria-valuemax={maxCents / 100}
        aria-valuenow={Math.min(subtotalCents, maxCents) / 100}
        aria-valuetext={message}
        className="mt-3 grid gap-2"
        style={columns}
      >
        {tiers.map((tier, index) => {
          const previous = index === 0 ? 0 : tiers[index - 1].cents;
          const percent = subtotalCents >= tier.cents ? 100
            : Math.max(0, (subtotalCents - previous) / Math.max(1, tier.cents - previous) * 100);
          return (
            <div key={tier.id} className="h-1.5 overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full bg-accent transition-all duration-300 motion-reduce:transition-none" style={{ width: percent + "%" }} />
            </div>
          );
        })}
      </div>
      <ol className="mt-2 grid gap-2 text-xs" style={columns}>
        {tiers.map(tier => {
          const unlocked = subtotalCents >= tier.cents;
          return (
            <li key={tier.id} className="min-w-0">
              <span className={unlocked ? "font-semibold text-success" : "font-semibold text-fg"}>
                {formatAud(tier.cents / 100, tier.cents % 100 ? 2 : 0)}+
              </span>
              <span className="mt-0.5 block break-words leading-snug text-fg-2">{tier.label}</span>
              {unlocked && <span className="mt-1 block text-success"><span aria-hidden="true">✓ </span>Unlocked</span>}
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        Rewards use the goods total after discounts and are confirmed at checkout.
        {giftThreshold !== undefined && " One free gift per order, while available."}
      </p>
    </section>
  );
}
