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
import { shippingRules } from './shipping-policy';

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
  return shippingRules(s).map(rule => ({
    method: rule.method, label: rule.label, baseCents: rule.rateCents,
    cents: subtotalCents <= 0 || subtotalCents >= rule.freeThresholdCents ? 0 : rule.rateCents,
    freeThresholdCents: rule.freeThresholdCents,
    isFree: subtotalCents > 0 && subtotalCents >= rule.freeThresholdCents,
    remainingCents: Math.max(0, rule.freeThresholdCents - subtotalCents), eta: rule.eta,
  }));
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
