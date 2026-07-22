/**
 * GA4 event helpers. Every function is a safe no-op when NEXT_PUBLIC_GA4_ID is
 * unset or when gtag hasn't loaded. Fires the four commerce events the spec
 * calls for: view_item / add_to_cart / begin_checkout / purchase.
 */

import { GA4_ID } from "./env";

type GtagArgs = [string, string, Record<string, unknown>?];
declare global {
  interface Window {
    gtag?: (...args: GtagArgs) => void;
    dataLayer?: unknown[];
  }
}

export const ga4Enabled = () => GA4_ID !== "";

function gtagEvent(event: string, params: Record<string, unknown>) {
  if (typeof window === "undefined" || !ga4Enabled() || typeof window.gtag !== "function") return;
  window.gtag("event", event, params);
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
