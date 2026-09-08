'use client';
import {useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {operateEmail} from '@/app/admin/(dashboard)/automation/actions';
import type {EmailOperation} from '@/lib/admin/email-operations';
export default function EmailOperationControls({id,status,providerAttemptedAt,leaseExpiresAt,providerId}:{id:string;status:string;providerAttemptedAt:string|null;leaseExpiresAt:string|null;providerId:string|null}){
 const router=useRouter();const [pending,start]=useTransition();const [reason,setReason]=useState(''),[provider,setProvider]=useState(providerId??''),[error,setError]=useState(''),[message,setMessage]=useState('');
 if(status==='sent'||status==='cancelled')return <span className="text-muted">Terminal intent</span>;
 if(status==='sending'&&(!leaseExpiresAt||Date.parse(leaseExpiresAt)>Date.now()))return <span className="text-muted">Active delivery lease — wait for worker outcome.</span>;
 const run=(action:EmailOperation)=>start(async()=>{
  setError('');setMessage('');
  try{const result=await operateEmail(id,action,reason,provider);if(result.ok){setMessage(result.message??'Operation saved.');router.refresh();}else setError(result.error??'Operation unavailable.');}
  catch{setError('Outcome could not be confirmed. Refresh the queue before another operation.');}
 });
 const disabled=pending||!reason.trim();
 const button='rounded border border-line px-2 py-1 disabled:opacity-50';
 return <div className="min-w-64 space-y-2">
  <label className="block">Operator reason<input disabled={pending} value={reason} maxLength={1000} onChange={e=>setReason(e.target.value)} className="mt-1 w-full rounded border border-line bg-ink-2 p-2"/></label>
  <div className="flex flex-wrap gap-2">
   {!providerAttemptedAt&&!providerId&&<button className={button} disabled={disabled} onClick={()=>run('cancel')}>Cancel unsent intent</button>}
   {['failed','dead','sending'].includes(status)&&<button className={button} disabled={disabled} onClick={()=>run('retry')}>Queue bounded retry</button>}
  </div>
  {(providerAttemptedAt||providerId)&&<>
   <p className="text-muted">Retry requires a safe original identity and elapsed backoff. Ambiguous sends need provider evidence.</p>
   <label className="block">Provider message ID<input disabled={pending} value={provider} maxLength={200} onChange={e=>setProvider(e.target.value)} className="mt-1 w-full rounded border border-line bg-ink-2 p-2"/></label>
   <button className={button} disabled={disabled||!provider.trim()} onClick={()=>run('reconcile')}>Reconcile provider acceptance</button>
  </>}
  {error&&<p role="alert" className="text-warn">{error}</p>}{message&&<p role="status">{message}</p>}
 </div>;
}
