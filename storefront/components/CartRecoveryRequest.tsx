'use client';
import {useState,useTransition} from 'react';
import {requestCartRecovery} from '@/app/cart-recovery/actions';
import type {ClientCartLine} from '@/lib/checkout';
export default function CartRecoveryRequest({email,lines}:{email:string;lines:ClientCartLine[]}) {
 const [agreed,setAgreed]=useState(false);const [pending,start]=useTransition();const [message,setMessage]=useState('');
 return <div className="mt-3 rounded-lg border border-line p-3 text-xs text-muted">
  <label className="flex items-start gap-2 text-fg-2"><input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)} className="mt-0.5"/>Email me a cart link and reminders for this cart.</label>
  <p className="mt-2">Confirm in your mailbox within 24 hours. Your link expires seven days after requesting it. Up to three reminders, at 1 hour, 24 hours and 72 hours after confirmation if still eligible. This does not sign you up for the newsletter. Stop reminders using the unsubscribe link in any reminder.</p>
  <button type="button" disabled={!agreed||pending||!email.trim()||!lines.length} onClick={()=>start(async()=>{try {const result=await requestCartRecovery(email,lines,agreed);setMessage(result.message);}catch{setMessage("We could not request your cart link. Please retry.");}})} className="mt-3 rounded-lg border border-accent px-3 py-2 text-accent disabled:opacity-60">{pending?'Requesting link…':'Email my cart link'}</button>
  {message&&<p role="status" className="mt-2">{message}</p>}
 </div>;
}
