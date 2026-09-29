'use server';
import { cookies, headers } from 'next/headers';
import { createHmac, randomBytes } from 'node:crypto';
import { isIP } from 'node:net';
import { supabaseAdmin } from '@/lib/supabase';
import { customerAccountsEnabled } from '@/lib/customer-orders/flags';
import { customerAuthProvider, customerCookieOptions, CHALLENGE_COOKIE, SESSION_COOKIE, sessionHash } from './server';
interface Result {ok:boolean;error?:string;email?:string}
const unavailable:Result={ok:false,error:'Sign-in is temporarily unavailable. Please try again shortly.'};
export async function requestCustomerCode(email:string):Promise<Result>{
 if(!customerAccountsEnabled())return unavailable;
 const clean=typeof email==='string'?email.trim().toLowerCase():'';
 if(clean.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean))return {ok:false,error:'Enter your checkout email address.'};
 const db=supabaseAdmin();if(!db)return unavailable;
 try{
  const h=await headers(),header=process.env.CUSTOMER_AUTH_TRUSTED_IP_HEADER||(process.env.VERCEL?'x-vercel-forwarded-for':'');
  const raw=header?h.get(header)?.split(',')[0]?.trim():'';
  const key=process.env.ORDER_ACCESS_SECRET??process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!key||key.length<32)return unavailable;
  // No arbitrary forwarded-for trust. Unknown addresses share a conservative bucket.
  const ipHash=createHmac('sha256',key).update(`customer-auth:${raw&&isIP(raw)?raw:'unknown'}`).digest('hex');
  const {data:challenge,error}=await db.rpc('customer_begin_login',{p_email:clean,p_ip_hash:ipHash});
  if(error||!challenge)return {ok:false,error:'Please wait before requesting another code.'};
  const result=await customerAuthProvider().auth.signInWithOtp({email:clean,options:{shouldCreateUser:true}});
  if(result.error)return unavailable;
  (await cookies()).set(CHALLENGE_COOKIE,String(challenge),{...customerCookieOptions,maxAge:600});
  return {ok:true,email:clean};
 }catch{return unavailable;}
}
export async function verifyCustomerCode(code:string):Promise<Result>{
 if(!customerAccountsEnabled())return unavailable;
 const failure:Result={ok:false,error:'That code is invalid or expired. Check it or request a new code.'};
 if(typeof code!=='string'||! /^\d{6,8}$/.test(code.trim()))return failure;
 const jar=await cookies(),challenge=jar.get(CHALLENGE_COOKIE)?.value;
 if(!challenge||! /^[0-9a-f-]{36}$/.test(challenge))return failure;
 const db=supabaseAdmin();if(!db)return unavailable;
 let lease:string|undefined;
 try{
  const reserved=await db.rpc('customer_reserve_verification',{p_challenge:challenge});
  if(reserved.error||!reserved.data)return failure;
  const email=String(reserved.data.email);lease=String(reserved.data.lease);
  const verified=await customerAuthProvider().auth.verifyOtp({email,token:code.trim(),type:'email'});
  const user=verified.data?.user;
  if(verified.error||!user?.email_confirmed_at||user.email?.trim().toLowerCase()!==email)return failure;
  const token=randomBytes(32).toString('base64url');
  const done=await db.rpc('customer_complete_login',{p_challenge:challenge,p_lease:lease,p_user:user.id,p_token_hash:sessionHash(token)});
  if(done.error)return failure;
  // Replace, rather than keep, an existing customer session on deliberate login.
  const old=jar.get(SESSION_COOKIE)?.value;
  if(old)await db.from('customer_sessions').delete().eq('token_hash',sessionHash(old));
  jar.set(SESSION_COOKIE,token,{...customerCookieOptions,maxAge:7*86400});jar.delete(CHALLENGE_COOKIE);
  return {ok:true};
 }catch{return unavailable;}finally{
  if(lease)try { await db.rpc('customer_finish_verification',{p_challenge:challenge,p_lease:lease}); } catch { /* The reservation self-expires after 30 seconds. */ }
 }
}
export async function customerSignOut():Promise<void>{
 const jar=await cookies(),token=jar.get(SESSION_COOKIE)?.value;
 if(token){const db=supabaseAdmin();if(db){const {error}=await db.from('customer_sessions').delete().eq('token_hash',sessionHash(token));if(error)throw new Error('Could not sign out. Please try again.');}}
 jar.delete(SESSION_COOKIE);jar.delete(CHALLENGE_COOKIE);
}
