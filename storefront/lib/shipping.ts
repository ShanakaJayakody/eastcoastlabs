import "server-only";

/**
 * Shipping rates and free-shipping thresholds.
 *
 * Previously the flat rate and threshold were hardcoded in four places
 * (checkout actions, two spots in admin/orders, and lib/env), which meant the
 * admin's "Free shipping over" field changed the announcement bar and nothing
 * else. This module is now the only place that decides what shipping costs.
 *
 * Two methods, each with its own free threshold, so the cart progress bar has a
 * second rung to climb after free standard is unlocked.
 */

import { getSettings, type StoreSettings } from "./settings";

export type ShippingMethod = "standard" | "express";

export const isShippingMethod = (v: unknown): v is ShippingMethod =>
  v === "standard" || v === "express";

export interface ShippingQuote {
  method: ShippingMethod;
  label: string;
  cents: number;
  /** Undiscounted rate — shown struck through when the tier is unlocked. */
  baseCents: number;
  freeThresholdCents: number;
  isFree: boolean;
  /** Cents still needed to unlock this tier (0 once unlocked). */
  remainingCents: number;
  eta: string;
}

/**
 * Price both shipping methods against an order subtotal (after discount).
 *
 * `subtotalCents` is the discounted goods total: a discount code reduces what
 * counts toward free shipping, which is the conservative reading and matches
 * how the order total is written.
 */
export function quoteShipping(subtotalCents: number, s: StoreSettings): ShippingQuote[] {
  const standardFree = Math.round(s.freeShippingThreshold * 100);
  const expressFree = Math.round(s.expressFreeThreshold * 100);

  const quotes: ShippingQuote[] = [
    {
      method: "standard",
      label: "Standard shipping",
      baseCents: s.standardShippingCents,
      // An empty cart ships for nothing — never quote postage on $0.
      cents: subtotalCents <= 0 ? 0 : subtotalCents >= standardFree ? 0 : s.standardShippingCents,
      freeThresholdCents: standardFree,
      isFree: subtotalCents > 0 && subtotalCents >= standardFree,
      remainingCents: Math.max(0, standardFree - subtotalCents),
      eta: "2–5 business days",
    },
  ];

  if (s.expressShippingEnabled) {
    quotes.push({
      method: "express",
      label: "Express shipping",
      baseCents: s.expressShippingCents,
      cents: subtotalCents <= 0 ? 0 : subtotalCents >= expressFree ? 0 : s.expressShippingCents,
      freeThresholdCents: expressFree,
      isFree: subtotalCents > 0 && subtotalCents >= expressFree,
      remainingCents: Math.max(0, expressFree - subtotalCents),
      eta: "1–2 business days",
    });
  }

  return quotes;
}

/**
 * The authoritative shipping charge for an order. Falls back to standard when
 * the requested method isn't offered, so a tampered or stale method can never
 * produce free express.
 */
export function shippingCentsFor(
  subtotalCents: number,
  method: ShippingMethod,
  s: StoreSettings,
): { cents: number; method: ShippingMethod } {
  const quotes = quoteShipping(subtotalCents, s);
  const match = quotes.find((q) => q.method === method) ?? quotes[0];
  return { cents: match.cents, method: match.method };
}

export async function getShippingQuotes(subtotalCents: number): Promise<ShippingQuote[]> {
  return quoteShipping(subtotalCents, await getSettings());
}
