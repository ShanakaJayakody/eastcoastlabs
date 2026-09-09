'use server';
import {randomUUID} from 'node:crypto';
import {after} from 'next/server';
import {cookies} from 'next/headers';
import {adminDb} from '@/lib/admin/db';
import {resolveCart,type ClientCartLine,type ResolvedCartLine} from '@/lib/checkout';
import {validCheckoutLines} from '@/lib/checkout-lines';
import {recoveryToken,recoveryTokenHash} from '@/lib/recovery-token';
import {RECOVERY_COOKIE} from '@/lib/recovery-consent';
import type {CartLine} from '@/lib/cart-context';

export async function requestCartRecovery(email:string,lines:ClientCartLine[],agreed:boolean):Promise<{ok:boolean;message:string}> {
 if(agreed!==true)return {ok:false,message:'Choose the cart link and reminders option first.'};
 if(typeof email!=='string'||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())||!validCheckoutLines(lines))return {ok:false,message:'Enter a valid email and review your cart.'};
 try {
  const resolved=await resolveCart(lines);
  if(!resolved.lines.length||resolved.warnings.length)return {ok:false,message:'Review the updated cart before requesting a link.'};
  const id=randomUUID();const hash=recoveryTokenHash(recoveryToken(id));
  const {data,error}=await adminDb().rpc('recovery_request',{p_id:id,p_email:email.trim().toLowerCase(),p_hash:hash,p_cart:resolved.lines,p_subtotal:resolved.subtotalCents});
  if(error)throw new Error('Request unavailable');
  if(data)try{after(async()=>{const {sendImmediately}=await import('@/lib/email/sender');await sendImmediately(String(data)).catch(()=>console.error('Cart confirmation awaits outbox retry'));});}catch{/* Durable outbox is picked up by cron. */}
  return {ok:true,message:'Check your email to confirm within 24 hours. If you recently requested a link, use that email.'};
 }catch{return {ok:false,message:'We could not save your cart link request. Please try again.'};}
}

export type CartRestoreResult={ok:true;lines:CartLine[];warnings:string[]}|{ok:false;message:string};
export async function confirmCartRecovery(token:string):Promise<CartRestoreResult> {
 const hash=recoveryTokenHash(token);if(!hash)return {ok:false,message:'This cart link is invalid or expired. Request a new link at checkout.'};
 try {
  const {data,error}=await adminDb().rpc('recovery_confirm',{p_hash:hash});
  if(error)throw new Error('Confirmation unavailable');
  if(!data)return {ok:false,message:'This cart link is expired or stopped. Request a new link at checkout.'};
  const saved=data as {cart:ResolvedCartLine[];episode_id:string;restore_expires_at:string};
  // Never trust old prices or availability when restoring.
  const resolved=await resolveCart(saved.cart);
  if(!resolved.lines.length)return {ok:false,message:'The saved items are no longer available. Your current cart has been kept.'};
  const lines:CartLine[]=resolved.lines.map(l=>({key:l.key,slug:l.slug,name:l.name,variantLabel:l.variantLabel,...(l.variantId?{variantId:l.variantId}:{}),productId:0,unitPrice:l.unitPriceCents/100,quantity:l.quantity}));
  (await cookies()).set(RECOVERY_COOKIE,token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/checkout',maxAge:Math.max(0,Math.min(7*86400,Math.floor((Date.parse(saved.restore_expires_at)-Date.now())/1000)))});
  return {ok:true,lines,warnings:resolved.warnings};
 }catch{return {ok:false,message:'We could not restore this cart. Your current cart has been kept. Please retry.'};}
}
