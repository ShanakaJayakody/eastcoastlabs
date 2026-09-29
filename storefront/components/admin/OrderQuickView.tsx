"use client";
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {X,ArrowUpRight} from 'lucide-react';
import {loadOrderPreview} from '@/app/admin/(dashboard)/orders/preview-actions';
import type {OrderDetail} from '@/lib/admin/order-queries';
import {orderItemVariantIdentity} from '@/lib/admin/order-item-identity';
import {formatAud} from '@/lib/format';
import {useDialogFocus} from './useDialogFocus';
import StatusBadge from './StatusBadge';
export default function OrderQuickView({orderId,onClose}:{orderId:string;onClose:()=>void}){
 const ref=useRef<HTMLDivElement>(null),[result,setResult]=useState<{id:string;order:OrderDetail|null}|null>(null);
 useDialogFocus(true,ref,onClose);
 useEffect(()=>{let active=true;loadOrderPreview(orderId).then(order=>{if(active)setResult({id:orderId,order});}).catch(()=>{if(active)setResult({id:orderId,order:null});});return()=>{active=false;};},[orderId]);
 const ready=result?.id===orderId,order=ready?result.order:null;
 return <div className="order-quick-backdrop" onClick={onClose}><div ref={ref} role="dialog" aria-modal="true" aria-label="Order quick view" tabIndex={-1} className="order-quick-view" onClick={e=>e.stopPropagation()}>
  <header><div><span>ORDER QUICK VIEW</span><h2>{order?.order_number??'Order details'}</h2></div><button aria-label="Close order quick view" onClick={onClose}><X size={21}/></button></header>
  {!ready?<p role="status">Loading order…</p>:!order?<p role="alert">This order is unavailable. Close this view and refresh the list.</p>:<>
   <div className="quick-summary"><StatusBadge status={order.status}/><strong>{formatAud(order.total_cents/100)}</strong></div>
   <h3>{order.customer_name||'Customer'}</h3>
   <p>Payment recorded: {order.paid_at?new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Melbourne',dateStyle:'medium',timeStyle:'short'}).format(new Date(order.paid_at)):'Not recorded'}</p>
   <p>{order.paid_at&&!order.shipped_at?`${Math.max(0,Math.floor((Date.now()-Date.parse(order.paid_at))/3600000))}h since payment · Melbourne time`:order.shipped_at?'Dispatch recorded':'Payment age unavailable'}</p>
   <section aria-label="Ordered items">{order.items.map(item=>{const identity=orderItemVariantIdentity(item.variant_label,item.size_label);return <article key={item.id} className="quick-item"><div><h3>{item.product_name||'Item'}</h3>{identity.sizeLabel&&<strong>{identity.sizeLabel}</strong>}<span>{identity.detailLabel} · Qty {item.qty}</span></div><span>{formatAud(item.line_total_cents/100)}</span></article>;})}</section>
   <footer><p>View only. Payment, dispatch and refund workflows remain on the full order.</p><Link href={`/admin/orders/${order.id}`}>Open full order <ArrowUpRight size={16}/></Link></footer>
  </>}
 </div></div>;
}
