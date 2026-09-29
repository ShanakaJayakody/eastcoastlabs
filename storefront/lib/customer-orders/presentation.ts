import type { RawOrder, CustomerOrderView } from './types';
export const ORDER_SITE='https://www.eastcoastlabs.com.au';
export function customerStatus(input:{status:string;payment_expires_at?:string|null},nowMs=Date.now()) {
 const expired=input.status==='pending'&&input.payment_expires_at!=null&&Date.parse(input.payment_expires_at)<=nowMs;
 const names:Record<string,string>={pending:'Awaiting payment',paid:'Payment confirmed',processing:'Preparing your order',shipped:'Dispatched',completed:'Order completed',cancelled:'Order cancelled',refunded:'Order refunded'};
 return {label:expired?'Reservation expired':names[input.status]??'Order received',showPayment:input.status==='pending'&&!expired&&Boolean(input.payment_expires_at&&Date.parse(input.payment_expires_at)>nowMs)};
}
export const CARRIERS:Record<string,{name:string;prefix:string}>={
 auspost:{name:'Australia Post',prefix:'https://auspost.com.au/mypost/track/#/details/'},
 dhl:{name:'DHL',prefix:'https://www.dhl.com/au-en/home/tracking.html?tracking-id='},
 fedex:{name:'FedEx',prefix:'https://www.fedex.com/fedextrack/?trknbr='},
 ups:{name:'UPS',prefix:'https://www.ups.com/track?tracknum='},
 sendle:{name:'Sendle',prefix:'https://track.sendle.com/tracking?ref='},
};
export function trackingLink(carrier:string|null|undefined,number:string){return carrier&&Object.hasOwn(CARRIERS,carrier)&&number.length<=200?CARRIERS[carrier].prefix+encodeURIComponent(number):null;}
/** Only public product assets are embedded; credentials and third-party pixels are rejected. */
export function receiptImageUrl(value:string|null|undefined):string|null{
 if(!value||value.length>2048||value.startsWith('//'))return null;
 try{
  const url=new URL(value,ORDER_SITE);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)return null;
  const own=[new URL(ORDER_SITE).origin,'https://eastcoastlabs.com.au'].includes(url.origin)&&/^\/(images|brand)\/[\w./-]+\.(png|jpe?g|webp)$/i.test(url.pathname);
  const supabase=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const storage=Boolean(supabase&&url.origin===new URL(supabase).origin&&/^\/storage\/v1\/object\/public\/product-images\/[\w./-]+\.(png|jpe?g|webp)$/i.test(url.pathname));
  return own||storage?url.href:null;
 }catch{return null;}
}
export function presentOrder(o:RawOrder,owner:boolean,nowMs=Date.now()):CustomerOrderView{
 const items=o.order_items.map(i=>({id:i.id,name:i.product_name??'Item',variantLabel:[i.size_label_snapshot,i.variant_label].filter(Boolean).join(' · '),quantity:i.qty,refundedQuantity:i.refunded_qty,lineTotalCents:i.line_total_cents-i.discount_allocated_cents,imageUrl:receiptImageUrl(i.image_url_snapshot),imageAlt:i.image_alt_snapshot||i.product_name||'Purchased item',isGift:/free gift/i.test(i.variant_label??'')}));
 return {id:o.id,number:o.order_number,createdAt:o.created_at,status:customerStatus(o,nowMs),items,
  totals:{subtotalCents:o.subtotal_cents,discountCents:o.discount_cents,shippingCents:o.shipping_cents,totalCents:o.total_cents,refundedCents:o.refunded_cents,currency:'AUD'},
  tracking:o.tracking_number?{number:o.tracking_number,carrierLabel:o.carrier_code&&Object.hasOwn(CARRIERS,o.carrier_code)?CARRIERS[o.carrier_code].name:null,url:trackingLink(o.carrier_code,o.tracking_number)}:null,
  milestones:[{label:'Order received',at:o.created_at},...(o.paid_at?[{label:'Payment confirmed',at:o.paid_at}]:[]),...(o.shipped_at?[{label:'Dispatched',at:o.shipped_at}]:[]),...(o.status==='completed'&&o.completed_at?[{label:'Order completed',at:o.completed_at}]:[])],
  payment:{method:o.payment_method==='payid'?'payid':'bank_transfer',paidAt:o.paid_at??null,expiresAt:o.payment_expires_at??null,reference:o.payment_reference??o.order_number},
  privateDetails:owner?{email:o.customer_email,name:o.customer_name??null,address:o.shipping_address??null}:null};
}
