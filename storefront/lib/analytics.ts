import { GA4_ID } from "./env";
import { analyticsConsent, publicMeasurementPath } from "./attribution";
import { getExperimentAssignments, type Variant } from "./variant";

type GtagArgs = [string, string | Date, Record<string, unknown>?];
declare global { interface Window { gtag?: (...args: GtagArgs) => void; dataLayer?: unknown[]; } }

export const ga4Enabled = () => /^G-[A-Z0-9]+$/i.test(GA4_ID);
export const analyticsAllowed = publicMeasurementPath;
export function safeAnalyticsLocation(href: string): string | null {
  try { const url = new URL(href); return analyticsAllowed(url.pathname) ? `${url.origin}${url.pathname}` : null; } catch { return null; }
}

const buffered: {event:string;params:Record<string,unknown>}[] = [];
const deduped = new Set<string>();
export function flushAnalytics() {
  if (typeof window === "undefined" || !ga4Enabled() || analyticsConsent() !== "granted") return;
  if (!safeAnalyticsLocation(window.location.href)) { buffered.length = 0; return; }
  if (typeof window.gtag !== "function") return;
  for (const entry of buffered.splice(0)) {
    try { window.gtag("event", entry.event, entry.params); } catch { /* Analytics cannot interrupt commerce. */ }
  }
}
function gtagEvent(event: string, params: Record<string, unknown>) {
  if (typeof window === "undefined" || !ga4Enabled() || analyticsConsent() !== "granted") { buffered.length = 0; return; }
  const pageLocation = safeAnalyticsLocation(window.location.href);
  if (!pageLocation) { buffered.length = 0; return; }
  const assignments = getExperimentAssignments();
  const assignment = assignments[0];
  // Keep the established dimension intact while measuring a rebrand that may
  // coexist with it. These fields persist through the shared commerce routes.
  const rebrand = assignments.find(entry => entry.experimentId === "rebrand-2026q3");
  buffered.push({event,params:{...(assignment?{experiment_id:assignment.experimentId,experiment_variant:assignment.variant}:{}),...(rebrand?{rebrand_experiment_id:rebrand.experimentId,rebrand_variant:rebrand.variant}:{}),...params,page_location:pageLocation,page_referrer:""}});
  if (buffered.length > 100) buffered.shift(); flushAnalytics();
}
export function trackPageView() { gtagEvent("page_view", {}); }
export function trackWebVital(metric: {name:string;value:number;rating?:string}) {
  if (!Number.isFinite(metric.value)) return;
  gtagEvent("web_vitals",{metric_name:metric.name,metric_value:metric.value,metric_rating:metric.rating});
}

export interface GaItem { item_id:string;item_name:string;price?:number;quantity?:number;item_variant?:string; }
export interface CommerceItemInput { slug:string;name:string;size?:string;pack?:string;price?:number;quantity?:number; }
const SLUG=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Physical size products use an internal generated suffix. Browser identity
 * remains the public parent catalogue slug; the database resolves the same
 * relationship through size_parent_id for paid snapshots. */
export const canonicalItemSlug=(slug:string)=>{
  if(typeof slug!=="string")return "unknown";
  const canonical=slug.trim().toLowerCase().replace(/-size-[0-9a-f]{32}$/i,"");
  return canonical.length<=100&&SLUG.test(canonical)?canonical:"unknown";
};
const label=(value:string|undefined,max=100)=>typeof value==="string"&&value.trim().length>0&&value.trim().length<=max?value.trim():undefined;
const commerceLabel=(value:string|undefined,max:number)=>{
  if(typeof value!=="string")return undefined;const normalized=value.trim();
  return normalized&&!/@|:\/\/|[\u0000-\u001f]/.test(normalized)?normalized.slice(0,max):undefined;
};
export function commerceItem(input:CommerceItemInput):GaItem {
  const variant=[commerceLabel(input.size,60),commerceLabel(input.pack,60)].filter(Boolean).join(" · ");
  return {item_id:canonicalItemSlug(input.slug),item_name:commerceLabel(input.name,100)??"Product",...(variant?{item_variant:variant}:{}),
    ...(Number.isFinite(input.price)&&Number(input.price)>=0?{price:Number(input.price)}:{}),
    ...(Number.isSafeInteger(input.quantity)&&Number(input.quantity)>=1&&Number(input.quantity)<=99?{quantity:Number(input.quantity)}:{})};
}

const usable=(item:GaItem)=>item.item_id!=="unknown";
export function trackOrderCreated(transactionId:string,items:GaItem[],value:number){const safe=items.filter(usable);if(!safe.length||deduped.has(`created:${transactionId}`))return;deduped.add(`created:${transactionId}`);gtagEvent("order_created",{transaction_id:transactionId,currency:"AUD",value,items:safe});}
export function trackViewItem(item:GaItem,value?:number){if(usable(item))gtagEvent("view_item",{currency:"AUD",value:value??item.price??0,items:[item]});}
export function trackViewItemList(items:GaItem[],listId:string,listName?:string){const id=label(listId,60),name=label(listName,100),safe=items.filter(usable).slice(0,200);if(!id||!safe.length)return;gtagEvent("view_item_list",{item_list_id:id,...(name?{item_list_name:name}:{}),items:safe});}
export function trackSelectItem(item:GaItem,listId:string,listName?:string){const id=label(listId,60),name=label(listName,100);if(!id||!usable(item))return;gtagEvent("select_item",{item_list_id:id,...(name?{item_list_name:name}:{}),items:[item]});}
export function trackSelectSize(item:GaItem){if(usable(item))gtagEvent("select_size",{items:[item]});}
export function trackSelectPack(item:GaItem){if(usable(item))gtagEvent("select_pack",{items:[item]});}
export function trackAddToCart(item:GaItem,value?:number){if(usable(item))gtagEvent("add_to_cart",{currency:"AUD",value:value??(item.price??0)*(item.quantity??1),items:[item]});}
export function trackRemoveFromCart(item:GaItem,value?:number){if(usable(item))gtagEvent("remove_from_cart",{currency:"AUD",value:value??(item.price??0)*(item.quantity??1),items:[item]});}
export function trackBeginCheckout(items:GaItem[],value:number){const safe=items.filter(usable);if(safe.length)gtagEvent("begin_checkout",{currency:"AUD",value,items:safe});}
export function trackPurchase(transactionId:string,items:GaItem[],value:number){if(deduped.has(`paid:${transactionId}`))return;deduped.add(`paid:${transactionId}`);gtagEvent("purchase",{transaction_id:transactionId,currency:"AUD",value,items});}

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const duration=(value:number)=>Number.isSafeInteger(value)&&value>=0&&value<=600_000;
export type QuoteErrorCode="timeout"|"network"|"server"|"invalid_response"|"stale";
const quoteErrors:readonly QuoteErrorCode[]=["timeout","network","server","invalid_response","stale"];
export function trackQuoteRequested(requestId:string){if(UUID.test(requestId))gtagEvent("quote_requested",{quote_request_id:requestId});}
export function trackQuoteReady(requestId:string,durationMs:number){if(UUID.test(requestId)&&duration(durationMs))gtagEvent("quote_ready",{quote_request_id:requestId,quote_duration_ms:durationMs});}
export function trackQuoteError(requestId:string,durationMs:number,code:QuoteErrorCode){if(UUID.test(requestId)&&duration(durationMs)&&quoteErrors.includes(code))gtagEvent("quote_error",{quote_request_id:requestId,quote_duration_ms:durationMs,error_code:code});}
export type PaymentStep="method_selected"|"order_submitted"|"order_created"|"instructions_viewed";
export type AnalyticsPaymentMethod="bank_transfer"|"payid";
const paymentSteps:readonly PaymentStep[]=["method_selected","order_submitted","order_created","instructions_viewed"];
const paymentMethods:readonly AnalyticsPaymentMethod[]=["bank_transfer","payid"];
export function trackPaymentStep(step:PaymentStep,method?:AnalyticsPaymentMethod){if(!paymentSteps.includes(step)||method!==undefined&&!paymentMethods.includes(method))return;gtagEvent("payment_step",{payment_step:step,...(method?{payment_method:method}:{})});}

export type CreatorEvent="creator_cta_click"|"creator_application_start"|"creator_application_submit"|"creator_application_error";
export type CreatorPlacement="hero"|"editorial"|"sticky"|"footer";
export type CreatorErrorCode="validation"|"rate_limited"|"unavailable"|"invalid_request"|"conflict"|"network";
const creatorEvents:readonly CreatorEvent[]=["creator_cta_click","creator_application_start","creator_application_submit","creator_application_error"];
const creatorPlacements:readonly CreatorPlacement[]=["hero","editorial","sticky","footer"];
const creatorErrorCodes:readonly CreatorErrorCode[]=["validation","rate_limited","unavailable","invalid_request","conflict","network"];
export function trackCreatorEvent(event:CreatorEvent,params:{placement?:CreatorPlacement;errorCode?:CreatorErrorCode}={}){
  if(!creatorEvents.includes(event)||typeof window==="undefined")return;
  try{if(new URL(window.location.href).pathname!=="/creators")return;}catch{return;}
  const safe:Record<string,unknown>={};if(params.placement&&creatorPlacements.includes(params.placement))safe.placement=params.placement;
  if(params.errorCode&&creatorErrorCodes.includes(params.errorCode))safe.error_code=params.errorCode;gtagEvent(event,safe);
}
export function trackExperimentImpression(experimentId:string,variant:Variant){if(!/^[a-z0-9][a-z0-9._~-]{0,63}$/.test(experimentId))return;gtagEvent("experiment_impression",{experiment_id:experimentId,experiment_variant:variant,variant});}
