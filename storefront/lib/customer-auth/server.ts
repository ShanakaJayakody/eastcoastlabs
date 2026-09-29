import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase';
export const SESSION_COOKIE='ecl_customer_session';
export const CHALLENGE_COOKIE='ecl_customer_challenge';
export const sessionHash=(token:string)=>createHash('sha256').update(token).digest('hex');
export const customerCookieOptions={httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax' as const,path:'/'};
export function customerAuthProvider(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key)throw new Error('Customer sign-in is unavailable');
 // No provider JWT or refresh token is stored in a browser cookie.
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}
export interface CustomerSession {userId:string;email:string}
export const getCustomerSession=cache(async():Promise<CustomerSession|null>=>{
 const token=(await cookies()).get(SESSION_COOKIE)?.value;
 if(!token||! /^[\w-]{43}$/.test(token))return null;
 const db=supabaseAdmin();if(!db)return null;
 const {data,error}=await db.rpc('customer_read_session',{p_hash:sessionHash(token)});
 if(error)throw new Error('Customer session temporarily unavailable');
 return data?{userId:String(data.user_id),email:String(data.email)}:null;
});
