import { beforeEach, expect, it, vi } from 'vitest';
import { listAdminSmsRecipients, sendMobileMessage, getMobileMessageBalance, mobileMessageConfig } from '@/lib/sms/mobile-message';

beforeEach(()=>{
  vi.stubEnv('MOBILE_MESSAGE_API_USERNAME','synthetic-api');vi.stubEnv('MOBILE_MESSAGE_API_PASSWORD','synthetic-secret');
  vi.stubEnv('MOBILE_MESSAGE_SENDER','61400000099');vi.stubEnv('MOBILE_MESSAGE_ADMIN_LIST_ID','28556');
});
const result=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status});
const lists={status:'complete',results:[{list_id:28556,name:'ECL Directors',contact_count:3}]};
const member=(id:number,number='61400000001')=>({contact_id:id,number,first_name:'Alex',last_name:'Director'});
const frozen={id:'00000000-0000-0000-0000-000000000001',to_phone:'61400000001',sender:'61400000099',body:'Synthetic business update',expected_parts:1,idempotency_key:'00000000-0000-0000-0000-000000000002',credential_fingerprint:''};

it('fully paginates the verified list and deduplicates normalized mobiles',async()=>{
  const urls:string[]=[];
  vi.stubGlobal('fetch',async(input:string)=>{urls.push(input);return urls.length===1?result(lists):urls.length===2?
    result({status:'complete',list_id:28556,total:3,offset:0,limit:2,results:[member(1),member(2,'0400 000 001')]}):
    result({status:'complete',list_id:28556,total:3,offset:2,limit:2,results:[member(3,'61400000002')]});});
  expect((await listAdminSmsRecipients()).map(r=>r.phone)).toEqual(['61400000001','61400000002']);
  expect(urls[2]).toContain('offset=2');
});
it('fails closed on a missing list, invalid phones, changed totals or incomplete pagination',async()=>{
  for(const bad of [
    {status:'complete',list_id:28556,total:3,offset:0,limit:100,results:[]},
    {status:'complete',list_id:28556,total:1,offset:0,limit:100,results:[member(1,'bad')]},
  ]){
    let i=0;vi.stubGlobal('fetch',async()=>result(++i===1?lists:bad));
    await expect(listAdminSmsRecipients()).rejects.toThrow();
  }
  vi.stubGlobal('fetch',async()=>result({status:'complete',results:[]}));
  await expect(listAdminSmsRecipients()).rejects.toThrow(/ECL Directors/);
});
it('sends the same frozen identity and body on retry and respects recipient opt-outs',async()=>{
  const calls:RequestInit[]=[];
  vi.stubGlobal('fetch',async(_url:string,init:RequestInit)=>{calls.push(init);return result({status:'complete',results:[{to:frozen.to_phone,status:'success',message_id:'provider-1',cost:1}]});});
  const row={...frozen,credential_fingerprint:mobileMessageConfig().fingerprint};
  expect(await sendMobileMessage(row)).toEqual({kind:'accepted',messageId:'provider-1',credits:1});
  await sendMobileMessage(row);
  expect(calls[0].body).toBe(calls[1].body);
  expect(new Headers(calls[0].headers).get('Idempotency-Key')).toBe(frozen.idempotency_key);
  expect(JSON.parse(String(calls[0].body))).toEqual({enable_unicode:false,max_parts:2,shorten_urls:false,ignore_unsubscribes:false,
    messages:[{to:frozen.to_phone,message:frozen.body,sender:frozen.sender,custom_ref:frozen.id}]});
});
it('never treats HTTP 200 with a blocked recipient or malformed success as accepted',async()=>{
  const row={...frozen,credential_fingerprint:mobileMessageConfig().fingerprint};
  vi.stubGlobal('fetch',async()=>result({status:'complete',results:[{to:frozen.to_phone,status:'blocked',error:'synthetic-secret'}]}));
  expect(await sendMobileMessage(row)).toEqual({kind:'rejected',reason:'Recipient blocked by provider'});
  vi.stubGlobal('fetch',async()=>result({status:'complete',results:[{to:frozen.to_phone,status:'success'}]}));
  expect(await sendMobileMessage(row)).toMatchObject({kind:'retryable'});
});
it('handles transport errors and HTTP failures without persisting provider text or credentials',async()=>{
  const row={...frozen,credential_fingerprint:mobileMessageConfig().fingerprint};
  for(const status of [401,403,429,503]){
    vi.stubGlobal('fetch',async()=>result({error:'synthetic-secret'},status));
    expect(await sendMobileMessage(row)).toMatchObject({kind:status<429?'rejected':'retryable',reason:`Mobile Message HTTP ${status}`});
  }
  vi.stubGlobal('fetch',async()=>{throw new Error('synthetic-secret')});
  expect(await sendMobileMessage(row)).toEqual({kind:'retryable',reason:'Mobile Message response uncertain; retry with the same request identity'});
  await expect(getMobileMessageBalance()).rejects.toThrow('Mobile Message account unavailable');
});
it('will not retry after API credential rotation',async()=>{
  expect(await sendMobileMessage(frozen)).toMatchObject({kind:'uncertain'});
});
