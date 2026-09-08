'use client';
import {useState,useTransition} from 'react';
import {confirmCartRecovery} from '@/app/cart-recovery/actions';
import {useCart} from '@/lib/cart-context';
export default function CartRecoveryRestore({token}:{token:string}) {
 const {replaceLines,ready}=useCart();const [pending,start]=useTransition();const [message,setMessage]=useState('');const [restored,setRestored]=useState(false);
 return <div className="mt-6">
  <p className="text-muted">Confirm your email to restore this cart and request up to three reminders at 1 hour, 24 hours and 72 hours after confirmation if still eligible. This does not subscribe you to the newsletter. The link expires seven days after you requested it.</p>
  <p className="mt-3 text-muted">This replaces the cart on this device. Prices and availability are checked again. Returning to an already confirmed link will restore the same cart without restarting reminders.</p>
  {!restored&&<button disabled={pending||!ready} onClick={()=>start(async()=>{try {const result=await confirmCartRecovery(token);if(!result.ok){setMessage(result.message);return;}replaceLines(result.lines);setRestored(true);setMessage(result.warnings.join(' ')||'Your cart is restored. Review the current total at checkout.');}catch{setMessage('We could not restore this cart. Your current cart has been kept. Please retry.');}})} className="mt-5 rounded-lg bg-accent px-5 py-3 font-semibold text-accent-ink disabled:opacity-60">{pending?'Restoring…':'Confirm and restore my cart'}</button>}
  {message&&<p role="status" className="mt-4">{message}</p>}
  {restored&&<a href="/checkout" className="mt-5 inline-block rounded-lg bg-accent px-5 py-3 font-semibold text-accent-ink">Review checkout</a>}
 </div>;
}
