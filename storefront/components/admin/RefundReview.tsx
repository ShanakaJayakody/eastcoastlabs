'use client';
import {useRef,useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {toast} from 'sonner';
import {formatAud} from '@/lib/format';
import type {RefundQuote,RefundSelection} from '@/lib/admin/refunds';
import {previewRefund,commitRefund} from '@/app/admin/(dashboard)/orders/refund-actions';
import ConfirmModal from './ConfirmModal';
const cents=(amount:number)=>formatAud(amount/100);
/** Mount a fresh dialog for each selection. A retry retains its reviewed token/key. */
export default function RefundReview({orderId,selection,onClose,onSuccess}:{orderId:string;selection:RefundSelection;onClose:()=>void;onSuccess?:()=>void}){
 const router=useRouter();
 const [pending,start]=useTransition();
 const [restock,setRestock]=useState(false);
 const [quote,setQuote]=useState<RefundQuote|null>(null);
 const [error,setError]=useState('');
 const key=useRef<string|null>(null);
 function submit(){start(async()=>{
  setError('');
  try{
   if(!quote){
    const result=await previewRefund(orderId,selection,restock);
    if(result.ok){setQuote(result.quote);key.current=crypto.randomUUID()}
    else setError(result.error);
    return;
   }
   key.current ??= crypto.randomUUID();
   const result=await commitRefund(orderId,selection,restock,quote.token,key.current);
   if(result.ok){toast.success(`Recorded refund ${cents(result.refundedCents)}`);onSuccess?.();onClose();router.refresh()}
   else {setError(result.error);if(result.stale){setQuote(null);key.current=null}}
  }catch{setError('The request could not be confirmed. Retry to check the same operation.')}
 })}
 return <ConfirmModal open title="Review refund" confirmLabel={quote?'Record refund':'Preview refund'} tone="danger" pending={pending} onConfirm={submit} onCancel={onClose} body={<>
  <p>This records a refund. Money is not transferred; return money through your bank separately. A refund record email is queued for the customer.</p>
  <label className="mt-3 flex gap-2"><input type="checkbox" disabled={pending} checked={restock} onChange={e=>{setRestock(e.target.checked);setQuote(null);key.current=null;setError('')}}/>Restore selected units to sellable stock only if physically returned or still on hand.</label>
  {quote && <div className="mt-3 space-y-1 border-t border-line pt-3">
   <ul className="max-h-48 overflow-y-auto">{quote.lines.map(line=><li key={line.itemId}>{line.qty} × {line.name ?? 'Item'}{line.label?` · ${line.label}`:''}: {cents(line.totalCents)}</li>)}</ul>
   <p>Items: {cents(quote.itemCents)}</p><p>Discount: −{cents(quote.discountCents)}</p><p>Shipping: {cents(quote.shippingCents)}</p>
   <p className="font-semibold">Refund to record: {cents(quote.totalCents)}</p><p>Remaining refundable: {cents(quote.remainingCents)}</p>
  </div>}
  {error && <p role="alert" className="mt-3 text-warn">{error}</p>}
 </>}/>;
}
