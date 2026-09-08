import 'server-only';
import { adminDb } from './db';
import type { LineRefund, RefundItemsResult } from './orders';
export type RefundSelection = LineRefund[] | null;
export interface RefundQuote {
 token:string;
 lines:{itemId:string;name:string|null;label:string|null;qty:number;itemCents:number;discountCents:number;totalCents:number}[];
 itemCents:number;discountCents:number;shippingCents:number;totalCents:number;remainingCents:number;fullyRefunded:boolean;
}
export interface RefundSettlement {
 id:string;amount_cents:number;transfer_reference:string;transfer_date:string;actor_email:string;created_at:string;
}
async function rpc<T>(name:string,args:Record<string,unknown>):Promise<T>{
 const {data,error}=await adminDb().rpc(name,args);
 if(error)throw new Error(error.message);
 if(!data)throw new Error('Missing refund operation result');
 return data as T;
}
export async function quoteRefund(orderId:string,selection:RefundSelection,restock:boolean):Promise<RefundQuote>{
 return rpc('commerce_refund_quote',{p_order:orderId,p_selection:selection,p_restock:restock});
}
export async function commitReviewedRefund(orderId:string,selection:RefundSelection,restock:boolean,token:string,key:string,actor:string):Promise<RefundItemsResult>{
 return rpc('commerce_refund_commit',{p_order:orderId,p_selection:selection,p_restock:restock,p_token:token,p_key:key,p_actor:actor});
}
export async function settleRefund(orderId:string,cents:number,reference:string,date:string,key:string,actor:string):Promise<RefundSettlement>{
 if(!Number.isSafeInteger(cents)||cents<=0)throw new Error('Enter a positive amount in cents');
 return rpc('commerce_refund_settle',{p_order:orderId,p_cents:cents,p_reference:reference,p_transfer_date:date,p_key:key,p_actor:actor});
}
export async function getRefundSettlements(orderId:string):Promise<RefundSettlement[]>{
 const {data,error}=await adminDb().from('refund_settlements').select('id,amount_cents,transfer_reference,transfer_date,actor_email,created_at').eq('order_id',orderId).order('created_at',{ascending:true});
 if(error)throw new Error(error.message);
 return data ?? [];
}
