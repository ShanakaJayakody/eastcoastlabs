export interface RawOrderItem {
 id:string;product_slug?:string|null;product_name:string|null;variant_label?:string|null;size_label_snapshot?:string|null;
 qty:number;refunded_qty:number;line_total_cents:number;discount_allocated_cents:number;
 image_url_snapshot?:string|null;image_alt_snapshot?:string|null;
}
export interface RawOrder {
 id:string;order_number:string;status:string;created_at:string;paid_at?:string|null;shipped_at?:string|null;completed_at?:string|null;
 payment_expires_at?:string|null;payment_method?:string|null;payment_reference?:string|null;
 customer_email:string;customer_name?:string|null;shipping_address?:Record<string,unknown>|null;
 customer_user_id?:string|null;order_access_version?:number;carrier_code?:string|null;tracking_number?:string|null;
 subtotal_cents:number;discount_cents:number;shipping_cents:number;total_cents:number;refunded_cents:number;
 order_items:RawOrderItem[];
}
export interface OrderLineView {
 id:string;name:string;variantLabel:string;quantity:number;refundedQuantity:number;lineTotalCents:number;
 imageUrl:string|null;imageAlt:string;isGift:boolean;
}
export interface CustomerOrderView {
 id:string;number:string;createdAt:string;status:{label:string;showPayment:boolean};items:OrderLineView[];
 totals:{subtotalCents:number;discountCents:number;shippingCents:number;totalCents:number;refundedCents:number;currency:'AUD'};
 tracking:{number:string;carrierLabel:string|null;url:string|null}|null;
 milestones:{label:string;at:string}[];
 payment:{method:'payid'|'bank_transfer';paidAt:string|null;expiresAt:string|null;reference:string};
 privateDetails:{email:string;name:string|null;address:Record<string,unknown>|null}|null;
}
