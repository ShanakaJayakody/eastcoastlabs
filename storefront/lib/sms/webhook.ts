import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { normalizeAustralianMobile } from './format';
export function verifyMobileMessageWebhook(raw:string,timestamp:string|null,signature:string|null,secret:string|undefined,now=new Date()):boolean {
  if(!secret||!timestamp||!/^\d{10}$/.test(timestamp)||!signature||!/^[a-f0-9]{64}$/i.test(signature)||Math.abs(now.getTime()/1000-Number(timestamp))>300)return false;
  const expected=createHmac('sha256',secret).update(timestamp+'.'+raw).digest();
  return timingSafeEqual(expected,Buffer.from(signature,'hex'));
}
export interface SmsReceipt {custom_ref:string;message_id:string;to:string;status:'sent'|'delivered'|'failed';part_number:number;total_parts:number}
export function parseMobileMessageReceipt(input:unknown):SmsReceipt|null {
  if(!input||typeof input!=='object')return null;
  const r=input as Record<string,unknown>;
  if(typeof r.custom_ref!=='string'||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(r.custom_ref)||typeof r.message_id!=='string'||!r.message_id||r.message_id.length>100||typeof r.to!=='string'||!normalizeAustralianMobile(r.to)||!['sent','delivered','failed'].includes(String(r.status))||!Number.isInteger(r.part_number)||!Number.isInteger(r.total_parts)||Number(r.total_parts)<1||Number(r.total_parts)>2||Number(r.part_number)<1||Number(r.part_number)>Number(r.total_parts))return null;
  return {custom_ref:r.custom_ref,message_id:r.message_id,to:normalizeAustralianMobile(r.to)!,status:r.status as SmsReceipt['status'],part_number:Number(r.part_number),total_parts:Number(r.total_parts)};
}
