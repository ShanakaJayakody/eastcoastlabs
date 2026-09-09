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

type GtagArgs = [string, string | Date, Record<string, unknown>?];
declare global {
  interface Window {
    gtag?: (...args: GtagArgs) => void;
    dataLayer?: unknown[];
  }
}

export const ga4Enabled = () => /^G-[A-Z0-9]+$/i.test(GA4_ID);

/** Only public catalogue/content paths may be sent; private identifiers are
 * rejected entirely, and query/hash/referrer are never included. */
export function analyticsAllowed(path: string): boolean {
  return /^(?:\/|\/1|\/(?:shop|stacks|lab-results|learn|about|checkout)|\/(?:product|collections|learn)\/[a-z0-9-]+)\/?$/.test(path);
}
export function safeAnalyticsLocation(href: string): string | null {
  try {
    const url = new URL(href);
    return analyticsAllowed(url.pathname) ? `${url.origin}${url.pathname}` : null;
  } catch { return null; }
}

const buffered: {event:string;params:Record<string,unknown>}[] = [];
const deduped = new Set<string>();
export function flushAnalytics() {
  if (typeof window === "undefined" || !ga4Enabled()) return;
  if (!safeAnalyticsLocation(window.location.href)) {buffered.length = 0;return;}
  if (typeof window.gtag !== "function") return;
  for (const entry of buffered.splice(0)) {
    try { window.gtag("event",entry.event,entry.params); } catch { /* Analytics cannot interrupt an order or navigation. */ }
  }
}
function gtagEvent(event: string, params: Record<string, unknown>) {
  if (typeof window === "undefined" || !ga4Enabled()) return;
  const pageLocation = safeAnalyticsLocation(window.location.href);
  if (!pageLocation) {buffered.length=0;return;}
  const variant = getVariant();
  buffered.push({event,params:{...(variant ? {variant} : {}),...params,page_location:pageLocation,page_referrer:""}});
  if (buffered.length > 100) buffered.shift();
  flushAnalytics();
}
export function trackPageView() { gtagEvent("page_view",{}); }
export function trackWebVital(metric: {name:string;value:number;rating?:string}) {
  if (!Number.isFinite(metric.value)) return;
  gtagEvent("web_vitals",{metric_name:metric.name,metric_value:metric.value,metric_rating:metric.rating});
}
export function trackOrderCreated(transactionId: string, items: GaItem[], value: number) {
  if (deduped.has(`created:${transactionId}`)) return;
  deduped.add(`created:${transactionId}`);
  gtagEvent("order_created",{transaction_id:transactionId,currency:"AUD",value,items});
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
  if (deduped.has(`paid:${transactionId}`)) return;
  deduped.add(`paid:${transactionId}`);
  gtagEvent("purchase", { transaction_id: transactionId, currency: "AUD", value, items });
}

/**
 * Records that a visitor saw one arm of a split test. Keeping this here rather
 * than calling gtag from the component keeps the guard logic in one place.
 */
export function trackExperimentImpression(experimentId: string, variant: Variant) {
  gtagEvent("experiment_impression", { experiment_id: experimentId, variant });
}
