import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
export interface OrderGrant { orderId:string; version:number; expiresAt:number }
type Options={secret?:string;nowMs?:number};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MAX={ov1:30*86400,oc1:86400};
export const orderCookieName=(id:string)=>`ecl-order-${id}`;
function secret(options:Options){return options.secret??process.env.ORDER_ACCESS_SECRET??process.env.SUPABASE_SERVICE_ROLE_KEY;}
function sign(value:string,key:string){return createHmac('sha256',key).update(`ecl-customer-order:${value}`).digest('base64url');}
function mint(kind:keyof typeof MAX,grant:OrderGrant,options:Options){
 const key=secret(options);if(!key||key.length<32)throw new Error('Order access signing key is not configured');
 if(!UUID.test(grant.orderId)||!Number.isSafeInteger(grant.version)||grant.version<1)throw new Error('Invalid order identity');
 const value=`${kind}.${grant.orderId}.${grant.version}.${grant.expiresAt}`;return `${value}.${sign(value,key)}`;
}
function verify(token:string|undefined,kind:keyof typeof MAX,options:Options):OrderGrant|null{
 const key=secret(options);if(!key||key.length<32||!token||token.length>240)return null;
 const p=token.split('.');if(p.length!==5||p[0]!==kind||!UUID.test(p[1])||!/^\d{1,10}$/.test(p[2])||!/^\d{10,11}$/.test(p[3])||! /^[\w-]{43}$/.test(p[4]))return null;
 const version=Number(p[2]),expiresAt=Number(p[3]),now=Math.floor((options.nowMs??Date.now())/1000);
 if(!Number.isSafeInteger(version)||version<1||expiresAt<=now||expiresAt>now+MAX[kind])return null;
 if(!timingSafeEqual(Buffer.from(sign(p.slice(0,4).join('.'),key)),Buffer.from(p[4])))return null;
 return {orderId:p[1],version,expiresAt};
}
export function createOrderViewToken(id:string,version=1,options:Options={}){return mint('ov1',{orderId:id.toLowerCase(),version,expiresAt:Math.floor((options.nowMs??Date.now())/1000)+MAX.ov1},options);}
export function verifyOrderViewToken(token:string|undefined,options:Options={}){return verify(token,'ov1',options);}
export function createOrderCookie(grant:OrderGrant,options:Options={}){return mint('oc1',{...grant,expiresAt:Math.min(grant.expiresAt,Math.floor((options.nowMs??Date.now())/1000)+MAX.oc1)},options);}
export function verifyOrderCookie(token:string|undefined,options:Options={}){return verify(token,'oc1',options);}
export function orderViewPath(id:string,version=1,options:Options={}){return `/orders/access?token=${encodeURIComponent(createOrderViewToken(id,version,options))}`;}
