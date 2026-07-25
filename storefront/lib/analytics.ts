/**
 * GA4 event helpers. Every function is a safe no-op when NEXT_PUBLIC_GA4_ID is
 * unset or when gtag hasn't loaded. Fires the four commerce events the spec
 * calls for: view_item / add_to_cart / begin_checkout / purchase.
 *
 * Every event also carries the A/B split-test arm, so conversions on the shared
 * /checkout can be attributed back to the landing design (see lib/variant.ts).
 */

import { GA4_ID } from "./env";
import { getVariant, type Variant } from "./variant";

type GtagArgs = [string, string, Record<string, unknown>?];
declare global {
  interface Window {
    gtag?: (...args: GtagArgs) => void;
    dataLayer?: unknown[];
  }
}

export const ga4Enabled = () => GA4_ID !== "";

/**
 * The single gtag call site. Merges the split-test arm into every outgoing
 * event as a top-level `variant` param.
 *
 * Note `variant` here is the A/B arm ("control" | "v1"), which is a different
 * concept from `GaItem.item_variant` — that one is the pack size ("3-pack") and
 * lives inside each item, not at the event level.
 *
 * The GA4-disabled guard runs first so nothing at all happens — not even the
 * cookie read — when analytics is switched off.
 *
 * An explicit `variant` in `params` wins over the cookie-derived one, because
 * a caller that just resolved the arm itself (VariantTag) holds the
 * authoritative value.
 */
function gtagEvent(event: string, params: Record<string, unknown>) {
  if (typeof window === "undefined" || !ga4Enabled() || typeof window.gtag !== "function") return;
  const variant = getVariant();
  // Omitted entirely when unattributed: GA4 records an explicit null as a real
  // value and it pollutes the variant breakdown.
  window.gtag("event", event, variant === null ? params : { variant, ...params });
}

export interface GaItem {
  item_id: string | number;
  item_name: string;
  price?: number;
  quantity?: number;
  item_variant?: string;
}

export function trackViewItem(item: GaItem, value?: number) {
  gtagEvent("view_item", { currency: "AUD", value: value ?? item.price ?? 0, items: [item] });
}

export function trackAddToCart(item: GaItem, value?: number) {
  gtagEvent("add_to_cart", {
    currency: "AUD",
    value: value ?? (item.price ?? 0) * (item.quantity ?? 1),
    items: [item],
  });
}

export function trackBeginCheckout(items: GaItem[], value: number) {
  gtagEvent("begin_checkout", { currency: "AUD", value, items });
}

export function trackPurchase(transactionId: string, items: GaItem[], value: number) {
  gtagEvent("purchase", { transaction_id: transactionId, currency: "AUD", value, items });
}

/**
 * Records that a visitor saw one arm of a split test. Keeping this here rather
 * than calling gtag from the component keeps the guard logic in one place.
 */
export function trackExperimentImpression(experimentId: string, variant: Variant) {
  gtagEvent("experiment_impression", { experiment_id: experimentId, variant });
}
