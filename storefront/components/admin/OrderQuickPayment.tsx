'use client';
import {useRef,useState} from 'react';
import {confirmPayment} from '@/app/admin/(dashboard)/orders/actions';
import {formatAud} from '@/lib/format';
import type {OrderPreview} from '@/lib/admin/order-workspace/types';
export default function OrderQuickPayment({preview,onStateChange,onSuccess,showSuccessNotice=true}:{preview:OrderPreview;onStateChange:(dirty:boolean,pending:boolean)=>void;onSuccess:()=>void;showSuccessNotice?:boolean}){
 const [reference,setReference]=useState(preview.order.payment_ref??''),[review,setReview]=useState(false),[pending,setPending]=useState(false),[error,setError]=useState(''),[done,setDone]=useState(false),busy=useRef(false);
 async function submit(){
  if(busy.current)return;busy.current=true;setPending(true);setError('');onStateChange(true,true);
  try{const result=await confirmPayment(preview.order.id,reference.trim());if(!result.ok)throw new Error(result.error);setDone(true);onStateChange(false,false);onSuccess();}
  catch(err){setError(err instanceof Error?err.message:'Unable to confirm payment. Try again.');onStateChange(true,false);}
  finally{busy.current=false;setPending(false);}
 }
 if(done)return showSuccessNotice?<p role="status">Payment recorded. Customer receipt queued.</p>:null;
 return <div className="ow-payment"><h3>Confirm bank transfer</h3><label>Payment reference<input value={reference} disabled={pending} maxLength={200} onChange={e=>{setReference(e.target.value);onStateChange(e.target.value!==(preview.order.payment_ref??'')||review,false);}}/></label>
 {review?<div className="ow-review"><p><strong>{preview.order.order_number} · {formatAud(preview.order.total_cents/100)}</strong></p><p>Reference: {reference.trim()||'Not provided'}</p><p>Confirms payment, commits stock, and queues the customer receipt.</p><div className="ow-actions"><button disabled={pending} onClick={()=>{setReview(false);onStateChange(reference!==(preview.order.payment_ref??''),false);}}>Back to reference</button><button className="ow-primary" disabled={pending} onClick={()=>void submit()}>{pending?'Confirming…':'Confirm payment'}</button></div></div>:<button className="ow-primary" onClick={()=>{setReview(true);onStateChange(true,false);}}>Review payment</button>}
 {pending&&<p role="status">Recording payment. Keep this order open.</p>}{error&&<p role="alert">{error}</p>}
 </div>;
}
