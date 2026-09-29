import { createHmac } from 'node:crypto';
import { expect, it } from 'vitest';
import { verifyMobileMessageWebhook, parseMobileMessageReceipt } from '@/lib/sms/webhook';
it('authenticates the exact raw body with a fresh signature and rejects tampering or replay',()=>{
  const raw='{"status":"delivered"}',secret='synthetic-signing-secret',timestamp='1790719200';
  const signature=createHmac('sha256',secret).update(timestamp+'.'+raw).digest('hex');
  const now=new Date(Number(timestamp)*1000);
  expect(verifyMobileMessageWebhook(raw,timestamp,signature,secret,now)).toBe(true);
  expect(verifyMobileMessageWebhook(raw+' ',timestamp,signature,secret,now)).toBe(false);
  expect(verifyMobileMessageWebhook(raw,timestamp,signature,secret,new Date(now.getTime()+301000))).toBe(false);
  expect(verifyMobileMessageWebhook(raw,timestamp,'bad',secret,now)).toBe(false);
  expect(verifyMobileMessageWebhook(raw,timestamp,signature,'',now)).toBe(false);
});
it('validates a receipt identity and its part numbers before applying it',()=>{
  const data={custom_ref:'00000000-0000-0000-0000-000000000001',message_id:'provider-1',to:'61400000001',status:'delivered',part_number:1,total_parts:2};
  expect(parseMobileMessageReceipt(data)).toEqual(data);
  expect(parseMobileMessageReceipt({...data,part_number:3})).toBeNull();
  expect(parseMobileMessageReceipt({...data,custom_ref:'unknown'})).toBeNull();
  expect(parseMobileMessageReceipt({...data,status:'made-up'})).toBeNull();
});
