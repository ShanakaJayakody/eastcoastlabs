import 'server-only';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';
import { getCustomerSession } from '@/lib/customer-auth/server';
import { orderCookieName, verifyOrderCookie } from './tokens';
import { historicalProductImage } from './media';
import { presentOrder } from './presentation';
import type { RawOrder } from './types';
const UUID=/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const COLUMNS='id,order_number,status,created_at,paid_at,shipped_at,completed_at,payment_expires_at,payment_method,payment_reference,customer_user_id,order_access_version,carrier_code,tracking_number,subtotal_cents,discount_cents,shipping_cents,total_cents,refunded_cents,order_items(id,product_slug,product_name,variant_label,size_label_snapshot,qty,refunded_qty,line_total_cents,discount_allocated_cents,image_url_snapshot,image_alt_snapshot)';
const PRIVATE_COLUMNS=',customer_email,customer_name,shipping_address';
/** Callers supply only an ID. Authority is derived here, never from a client DTO. */
export async function getCustomerOrder(id:string){
 if(!UUID.test(id))return null;
 const db=supabaseAdmin();if(!db)return null;
 const session=await getCustomerSession();
 if(session){
  const {data,error}=await db.from('orders').select(COLUMNS+PRIVATE_COLUMNS).eq('id',id).eq('customer_user_id',session.userId).maybeSingle();
  if(error)throw new Error('Order temporarily unavailable');
  const row=data as unknown as RawOrder|null;
  if(row&&row.customer_user_id===session.userId)return presentOrder(await withHistoricalImages(row),true);
 }
 const grant=verifyOrderCookie((await cookies()).get(orderCookieName(id.toLowerCase()))?.value);
 if(!grant||grant.orderId!==id.toLowerCase())return null;
 const {data,error}=await db.from('orders').select(COLUMNS).eq('id',id).eq('order_access_version',grant.version).maybeSingle();
 if(error)throw new Error('Order temporarily unavailable');
 if(!data||data.order_access_version!==grant.version||data.id!==grant.orderId)return null;
 return presentOrder(await withHistoricalImages(data as unknown as RawOrder),false);
}
async function withHistoricalImages(order:RawOrder):Promise<RawOrder>{
 const slugs=[...new Set(order.order_items.filter(i=>!i.image_url_snapshot&&i.product_slug).map(i=>i.product_slug!))];
 if(!slugs.length)return order;
 const db=supabaseAdmin();if(!db)return order;
 const {data,error}=await db.from('products').select('slug,size_label,size_parent_id,images').in('slug',slugs);
 if(error)return order; // An unavailable catalogue must not hide the receipt.
 const products=new Map((data??[]).map(p=>[p.slug,p]));
 return {...order,order_items:order.order_items.map(i=>{
  const p=products.get(i.product_slug);
  if(i.image_url_snapshot||!p)return i;
  return {...i,image_url_snapshot:historicalProductImage(p,i.size_label_snapshot,i.variant_label)};
 })};
}
export function parseOrderCursor(value:string|undefined):{at:string;id:string}|null{
 if(!value||value.length>200)return null;
 try{const v=JSON.parse(Buffer.from(value,'base64url').toString('utf8'));return typeof v.at==='string'&&/^\d{4}-\d\d-\d\dT[\d:.]+(?:Z|\+00:00)$/.test(v.at)&&Number.isFinite(Date.parse(v.at))&&typeof v.id==='string'&&UUID.test(v.id)?v:null;}catch{return null;}
}
export async function listCustomerOrders(cursor?:string){
 const session=await getCustomerSession();if(!session)return null;
 const db=supabaseAdmin();if(!db)throw new Error('Order history temporarily unavailable');
 const claim=await db.rpc('customer_claim_orders',{p_user:session.userId});if(claim.error)throw new Error('Order history temporarily unavailable');
 let query=db.from('orders').select(COLUMNS).eq('customer_user_id',session.userId).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(21);
 const after=parseOrderCursor(cursor);
 if(after)query=query.or(`created_at.lt.${after.at},and(created_at.eq.${after.at},id.lt.${after.id})`);
 const {data,error}=await query;if(error)throw new Error('Order history temporarily unavailable');
 const rows=(data??[]) as unknown as RawOrder[];
 const safe=rows.filter(row=>row.customer_user_id===session.userId),page=safe.slice(0,20),last=page.at(-1);
 return {email:session.email,orders:await Promise.all(page.map(async row=>presentOrder(await withHistoricalImages(row),false))),nextCursor:safe.length>20&&last?Buffer.from(JSON.stringify({at:last.created_at,id:last.id})).toString('base64url'):null};
}
