'use client';
import {useRef,useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {formatAud} from '@/lib/format';
import type {RefundSettlement} from '@/lib/admin/refunds';
import {recordRefundSettlement} from '@/app/admin/(dashboard)/orders/refund-actions';
export default function RefundSettlements({orderId,refundedCents,settlements}:{orderId:string;refundedCents:number;settlements:RefundSettlement[]}){
 const router=useRouter();const [pending,start]=useTransition();
 const [amount,setAmount]=useState(''),[reference,setReference]=useState(''),[date,setDate]=useState(''),[confirmed,setConfirmed]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false);
 const attempt=useRef<{signature:string;key:string}|null>(null);
 const settled=settlements.reduce((sum,row)=>sum+row.amount_cents,0),remaining=refundedCents-settled;
 const cents=Math.round(Number(amount)*100);
 const valid=/^\d+(\.\d{1,2})?$/.test(amount)&&Number.isSafeInteger(cents)&&cents>0&&cents<=remaining&&reference.trim().length>0&&date&&confirmed;
 const field='mt-1 w-full rounded-lg border border-line bg-ink-2 px-3 py-2';
 return <section className="space-y-3 rounded-xl border border-line bg-surface p-4 text-sm">
  <h3 className="font-semibold">Refund transfers</h3><p>Recorded refunds: {formatAud(refundedCents/100)}</p><p>Settled: {formatAud(settled/100)}</p><p>Still to settle: {formatAud(remaining/100)}</p>
  <p className="text-muted">Record a bank transfer you have already completed. This does not send money.</p>
  {settlements.length>0&&<ul className="space-y-2">{settlements.map(row=><li key={row.id}>{formatAud(row.amount_cents/100)} · {row.transfer_reference} · {row.transfer_date}<span className="block text-xs text-muted">Recorded by {row.actor_email} · {new Date(row.created_at).toLocaleString('en-AU')}</span></li>)}</ul>}
  {remaining>0&&<form className="space-y-3" onSubmit={event=>{event.preventDefault();if(!valid||pending)return;start(async()=>{
   setError('');setSaved(false);const signature=JSON.stringify({cents,reference,date});if(attempt.current?.signature!==signature)attempt.current={signature,key:crypto.randomUUID()};
   try{const result=await recordRefundSettlement(orderId,cents,reference.trim(),date,attempt.current.key);if(result.ok){setSaved(true);setAmount('');setReference('');setDate('');setConfirmed(false);attempt.current=null;router.refresh()}else setError(result.error)}catch{setError('The request could not be confirmed. Retry to check the same transfer record.')}
  })}}>
   <label className="block">Amount transferred (AUD)<input required disabled={pending} inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} className={field}/></label>
   <label className="block">Transfer reference<input required disabled={pending} maxLength={200} value={reference} onChange={e=>setReference(e.target.value)} className={field}/></label>
   <label className="block">Transfer date<input required disabled={pending} type="date" value={date} onChange={e=>setDate(e.target.value)} className={field}/></label>
   <label className="flex gap-2"><input type="checkbox" disabled={pending} checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I have already made this transfer and checked the reference and amount.</label>
   <button disabled={!valid||pending} className="rounded-lg bg-accent px-3 py-2 text-accent-ink disabled:opacity-50">{pending?'Recording…':'Record completed transfer'}</button>
  </form>}
  {error&&<p role="alert" className="text-warn">{error}</p>}{saved&&<p role="status">Completed transfer recorded.</p>}
 </section>;
}
