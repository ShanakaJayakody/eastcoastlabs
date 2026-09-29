import 'server-only';
import { createHash } from 'node:crypto';
import { normalizeAustralianMobile, smsSegments } from './format';
import type { FrozenSms, SmsRecipient, SmsSendResult } from './types';

const BASE='https://api.mobilemessage.com.au';
type ObjectValue=Record<string,unknown>;
const object=(v:unknown):v is ObjectValue=>!!v&&typeof v==='object'&&!Array.isArray(v);
export function mobileMessageConfig() {
  const username=process.env.MOBILE_MESSAGE_API_USERNAME;
  const password=process.env.MOBILE_MESSAGE_API_PASSWORD;
  const sender=normalizeAustralianMobile(process.env.MOBILE_MESSAGE_SENDER??'');
  const listId=Number(process.env.MOBILE_MESSAGE_ADMIN_LIST_ID);
  if(!username||!password||!sender||!Number.isSafeInteger(listId)||listId<=0) throw new Error('Mobile Message configuration is incomplete');
  return {sender,listId,authorization:`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
    fingerprint:createHash('sha256').update(username+'\0'+password).digest('hex')};
}
async function read(path:string,label:string):Promise<ObjectValue> {
  const config=mobileMessageConfig();
  try {
    const r=await fetch(BASE+path,{headers:{Authorization:config.authorization},cache:'no-store',signal:AbortSignal.timeout(8000)});
    if(!r.ok)throw new Error();
    const data:unknown=await r.json();
    if(!object(data)||data.status!=='complete')throw new Error();
    return data;
  } catch { throw new Error(`Mobile Message ${label} unavailable`); }
}
export async function listAdminSmsRecipients():Promise<SmsRecipient[]> {
  const {listId}=mobileMessageConfig();
  const lists=await read('/v1/lists','director list');
  if(!Array.isArray(lists.results)||!lists.results.some(v=>object(v)&&v.list_id===listId&&v.name==='ECL Directors'))
    throw new Error('ECL Directors list could not be verified');
  let total:number|null=null,offset=0;
  const byPhone=new Map<string,SmsRecipient>(),contacts=new Set<number>();
  do {
    const page=await read(`/v1/list-contacts?list_id=${listId}&limit=100&offset=${offset}`,'director members');
    if(page.list_id!==listId||!Number.isSafeInteger(page.total)||Number(page.total)<1||Number(page.total)>100||page.offset!==offset||!Array.isArray(page.results)||!page.results.length)
      throw new Error('Director list is empty or incomplete');
    if(total!==null&&page.total!==total)throw new Error('Director list changed during lookup; retry later');
    total=Number(page.total);
    for(const row of page.results){
      if(!object(row)||!Number.isSafeInteger(row.contact_id)||Number(row.contact_id)<=0||typeof row.number!=='string'||contacts.has(Number(row.contact_id)))
        throw new Error('Director list contains an invalid or repeated contact');
      const phone=normalizeAustralianMobile(row.number);
      if(!phone)throw new Error('Director list contains an invalid Australian mobile');
      contacts.add(Number(row.contact_id));
      const name=[row.first_name,row.last_name].filter(x=>typeof x==='string').join(' ').trim().slice(0,120);
      if(!byPhone.has(phone))byPhone.set(phone,{contactId:Number(row.contact_id),name,phone});
    }
    offset+=page.results.length;
    if(offset>total)throw new Error('Director list pagination is inconsistent');
  } while(offset<total);
  return [...byPhone.values()];
}
export async function getMobileMessageBalance():Promise<number> {
  const account=await read('/v1/account','account');
  if(typeof account.credit_balance!=='number'||!Number.isFinite(account.credit_balance)||account.credit_balance<0)
    throw new Error('Mobile Message balance unavailable');
  return account.credit_balance;
}
export async function sendMobileMessage(message:FrozenSms):Promise<SmsSendResult> {
  const config=mobileMessageConfig();
  if(config.fingerprint!==message.credential_fingerprint)return {kind:'uncertain',reason:'API identity changed; reconcile before retrying'};
  if(!normalizeAustralianMobile(message.to_phone)||smsSegments(message.body)!==message.expected_parts)
    return {kind:'rejected',reason:'Frozen SMS validation failed'};
  const body=JSON.stringify({enable_unicode:false,max_parts:2,shorten_urls:false,ignore_unsubscribes:false,
    messages:[{to:message.to_phone,message:message.body,sender:message.sender,custom_ref:message.id}]});
  try {
    const response=await fetch(BASE+'/v1/messages',{method:'POST',headers:{Authorization:config.authorization,'Content-Type':'application/json','Idempotency-Key':message.idempotency_key},body,signal:AbortSignal.timeout(10000),cache:'no-store'});
    if(!response.ok)return {kind:response.status===429||response.status>=500?'retryable':'rejected',reason:`Mobile Message HTTP ${response.status}`};
    const result:unknown=await response.json();
    if(!object(result)||result.status!=='complete'||!Array.isArray(result.results)||result.results.length!==1)throw new Error();
    const receipt=result.results[0];
    if(!object(receipt)||receipt.to!==message.to_phone)throw new Error();
    if(receipt.status==='blocked')return {kind:'rejected',reason:'Recipient blocked by provider'};
    if(receipt.status==='error')return {kind:'rejected',reason:'Message rejected by provider'};
    if(receipt.status!=='success'||typeof receipt.message_id!=='string'||!receipt.message_id||receipt.message_id.length>100||!Number.isFinite(Number(receipt.cost))||Number(receipt.cost)<=0)throw new Error();
    return {kind:'accepted',messageId:receipt.message_id,credits:Number(receipt.cost)};
  } catch { return {kind:'retryable',reason:'Mobile Message response uncertain; retry with the same request identity'}; }
}
