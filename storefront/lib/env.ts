/**
 * Central environment accessors. Values are inlined at build time via
 * next.config.ts `env` mapping, so these read correctly on both server and
 * client. Everything here is a non-secret public endpoint.
 */

const stripTrailingSlash = (u: string) => u.replace(/\/+$/, "");

/** WooCommerce Store API + custom ECL REST base (no trailing slash). */
export const WOO_API_BASE = stripTrailingSlash(
  process.env.WOO_API_BASE ?? "https://eastcoastlabs.com.au",
);

/**
 * Full checkout URL for the WooCommerce hand-off.
 *
 * The spec allows WOO_CHECKOUT_BASE to be either the site base
 * (https://eastcoastlabs.com.au) or the full checkout URL
 * (https://eastcoastlabs.com.au/checkout). We normalise both to a single
 * "<base>/checkout" so the hand-off is always correct.
 */
export function checkoutUrl(): string {
  const base = stripTrailingSlash(
    process.env.WOO_CHECKOUT_BASE ?? "https://eastcoastlabs.com.au",
  );
  return base.endsWith("/checkout") ? base : `${base}/checkout`;
}

export const GA4_ID = process.env.NEXT_PUBLIC_GA4_ID ?? "";

/** Free-shipping threshold in AUD (major units). */
export const FREE_SHIPPING_THRESHOLD = 150;

/** Spend threshold (AUD) that unlocks a free bacteriostatic-water gift. */
export const GIFT_THRESHOLD = 250;
