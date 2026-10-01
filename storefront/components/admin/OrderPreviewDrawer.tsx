'use client';
import {useEffect,useRef,useState} from 'react';
import {formatAud} from '@/lib/format';
import {orderWorkspaceHref,safeOrdersReturnTo} from '@/lib/admin/order-workspace/params';
import {orderDate,physicalQuantityLabel,waitingLabel} from '@/lib/admin/order-workspace/presentation';
import {orderItemVariantIdentity} from '@/lib/admin/order-item-identity';
import type {OrderPreview,OrderWorkspaceParams} from '@/lib/admin/order-workspace/types';
import {OrderIssues,OrderShipping} from './OrderWorkspaceTable';
import OrderStatusPair from './OrderStatusPair';
import OrderQuickPayment from './OrderQuickPayment';
interface Props {message?:string;noLongerMatches?:boolean;id:string|null;params:OrderWorkspaceParams;neighborIds:string[];onClose:()=>void;onNavigate:(id:string)=>void;onMutated:()=>void;onRestoreFocus:()=>void;}
export default function OrderPreviewDrawer({message,noLongerMatches,id,params,neighborIds,onClose,onNavigate,onMutated,onRestoreFocus}:Props){
 const dialog=useRef<HTMLDialogElement>(null),restore=useRef(onRestoreFocus);restore.current=onRestoreFocus;
 const [loaded,setLoaded]=useState<{id:string;preview?:OrderPreview;error?:string;missing?:boolean}|null>(null),[reload,setReload]=useState(0),[dirty,setDirty]=useState(false),[writing,setWriting]=useState(false),[discard,setDiscard]=useState<(()=>void)|null>(null);
 const open=Boolean(id);
 useEffect(()=>{if(!open)return;const el=dialog.current;const overflow=document.body.style.overflow;document.body.style.overflow='hidden';if(el&&!el.open)el.showModal();return()=>{el?.close();document.body.style.overflow=overflow;restore.current();};},[open]);
 useEffect(()=>{
  if(!id)return;const controller=new AbortController();let active=true;setDirty(false);setDiscard(null);
  void (async()=>{try{
   const response=await fetch(`/admin/orders/${id}/preview`,{cache:'no-store',signal:controller.signal});
   if(response.redirected||response.status===401||response.status===403||!response.headers.get('content-type')?.includes('application/json'))throw new Error('Sign in again to view order details.');
   if(response.status===404){if(active)setLoaded({id,missing:true,error:'Order no longer available'});return;}
   if(!response.ok)throw new Error(response.status===409?'This order changed. Reload its details.':'Unable to load order. Try again.');
   const preview:OrderPreview=await response.json();if(preview.order?.id!==id||preview.facts?.id!==id||preview.fulfilment?.orderId!==id||!Array.isArray(preview.order.items)||!Array.isArray(preview.fulfilment.lines))throw new Error('Unable to load order. Try again.');
   if(active)setLoaded({id,preview});
  }catch(error){if(active&&!controller.signal.aborted)setLoaded({id,error:error instanceof Error?error.message:'Unable to load order. Try again.'});}})();
  return()=>{active=false;controller.abort();};
 },[id,reload]);
 const preview=loaded?.id===id?loaded.preview:undefined,error=loaded?.id===id?loaded.error:undefined;
 function leave(action:()=>void){if(writing)return;if(dirty){setDiscard(()=>action);return;}action();}
 if(!id)return null;
 const position=neighborIds.indexOf(id),returnTo=safeOrdersReturnTo(orderWorkspaceHref(params,{order:null}));
 const fullHref=`/admin/orders/${id}?${new URLSearchParams({returnTo})}`,packHref=`/admin/orders/${id}/pack?${new URLSearchParams({returnTo})}`;
 const guardedLink=(event:React.MouseEvent<HTMLAnchorElement>,href:string)=>{if(writing){event.preventDefault();return;}if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;if(dirty){event.preventDefault();leave(()=>window.location.assign(href));}};
 return <dialog ref={dialog} className="ow-drawer" aria-labelledby="order-preview-title" onCancel={e=>{e.preventDefault();leave(onClose);}} onClick={e=>{if(e.target===e.currentTarget&&e.clientX<e.currentTarget.getBoundingClientRect().left)leave(onClose);}}>
  <header className="ow-drawer-header"><div><h2 id="order-preview-title">{preview?`Order ${preview.order.order_number}`:'Order details'}</h2><p className="ow-secondary">{position>=0?`${position+1} of ${neighborIds.length} on this page`:'Opened from a link'}</p></div><button aria-label="Close order" disabled={writing} onClick={()=>leave(onClose)}>Close ×</button></header>
  <div className="ow-drawer-body">
   {message&&<p role="status">{message}</p>}{noLongerMatches&&<p>This order no longer matches this view.</p>}
   {discard&&<div className="ow-review" role="alert"><p>Discard the unsaved payment reference?</p><div className="ow-actions"><button onClick={()=>setDiscard(null)} autoFocus>Keep editing</button><button onClick={()=>{setDirty(false);setDiscard(null);discard();}}>Discard changes</button></div></div>}
   {!preview&&!error&&<p role="status">Loading order…</p>}
   {error&&<div role="alert"><p>{error}</p>{!loaded?.missing&&<button onClick={()=>{setLoaded(null);setReload(n=>n+1);}}>Retry</button>}{error.startsWith('Sign in')&&<a href="/admin/login">Sign in</a>}</div>}
   {preview&&<>
    <div className="ow-drawer-summary"><div><p>{preview.order.customer_name||preview.order.customer_email}</p>{preview.order.customer_name&&<p className="ow-secondary ow-wrap">{preview.order.customer_email}</p>}</div><strong>{formatAud(preview.order.total_cents/100)}</strong></div>
    <OrderStatusPair row={preview.facts}/><OrderIssues row={preview.facts}/><p>{waitingLabel(preview.facts)}</p>
    <section><h3>Shipping</h3><OrderShipping row={preview.facts}/><address className="ow-address">{['name','line1','line2','suburb','city','state','postcode','country'].map(k=>preview.order.shipping_address?.[k]?<span key={k}>{preview.order.shipping_address[k]}</span>:null)}</address>{preview.order.tracking_number&&<p className="ow-wrap">Tracking: {preview.order.tracking_number}</p>}</section>
    <section><h3>Items · {physicalQuantityLabel(preview.facts)}</h3>{preview.order.items.map(i=>{const identity=orderItemVariantIdentity(i.variant_label,i.size_label);return <div className="ow-preview-item ow-wrap" key={i.id}><p>{i.qty} × {i.product_name||'Historical item'} <strong>{identity.sizeLabel}</strong></p><p className="ow-secondary">{identity.detailLabel}{i.sku?` · ${i.sku}`:''}{i.refunded_qty?` · ${i.refunded_qty} refunded`:''}</p></div>;})}
    {preview.fulfilment.lines.length>0&&preview.order.status!=='pending'&&<p className="ow-secondary">Lot allocation: {preview.fulfilment.lines.reduce((n,l)=>n+l.allocatedUnits,0)} of {preview.fulfilment.lines.reduce((n,l)=>n+l.requiredUnits,0)} required physical units assigned. Review allocations in packing.</p>}</section>
    <p className="ow-secondary">Placed {orderDate(preview.order.created_at)} · Sydney time</p>
    {preview.order.status==='pending'&&<OrderQuickPayment key={id} preview={preview} onStateChange={(draft,pending)=>{setDirty(draft);setWriting(pending);}} onSuccess={()=>{setDirty(false);setWriting(false);setReload(n=>n+1);onMutated();}}/>}
    <details><summary>Internal notes</summary><p className="ow-wrap whitespace-pre-wrap">{preview.order.notes||'No internal notes.'}</p></details>
    <details><summary>Activity ({preview.order.events.length})</summary>{preview.order.events.map((event,i)=><p key={i} className="ow-secondary ow-wrap">{orderDate(event.created_at)} · {event.message||event.type}</p>)}</details>
   </>}
  </div>
  <footer className="ow-drawer-footer"><div className="ow-actions"><button disabled={writing||position<=0} onClick={()=>leave(()=>onNavigate(neighborIds[position-1]))}>Previous order</button><button disabled={writing||position<0||position>=neighborIds.length-1} onClick={()=>leave(()=>onNavigate(neighborIds[position+1]))}>Next order</button></div><div className="ow-actions"><a aria-disabled={writing||undefined} href={fullHref} onClick={e=>guardedLink(e,fullHref)}>Open full order</a>{preview&&['paid','processing'].includes(preview.order.status)&&<a className="ow-primary" aria-disabled={writing||undefined} href={packHref} onClick={e=>guardedLink(e,packHref)}>Open packing</a>}</div></footer>
 </dialog>;
}
