import { createHmac } from 'node:crypto';
import { beforeEach,expect,it,vi } from 'vitest';
const fakes=vi.hoisted(()=>({rpc:vi.fn(),run:vi.fn(),alert:vi.fn()}));
vi.mock('@/lib/admin/db',()=>({adminDb:()=>({rpc:fakes.rpc})}));
vi.mock('@/lib/admin/daily-sms',()=>({runDailyAdminSms:fakes.run,queueAdminSmsAlert:fakes.alert}));
vi.mock('@/lib/admin/cron-runs',()=>({recordCronRun:async(_name:string,work:()=>Promise<unknown>)=>work()}));
beforeEach(()=>{fakes.rpc.mockReset();fakes.run.mockReset();fakes.alert.mockReset()});
it('authenticates cron preview and normal sends before accessing business data',async()=>{
  const {GET}=await import('@/app/api/cron/admin-sms/route');
  vi.stubEnv('CRON_SECRET','synthetic-cron');
  expect((await GET(new Request('https://example.test/api/cron/admin-sms?dry=1'))).status).toBe(401);
  expect(fakes.run).not.toHaveBeenCalled();
  fakes.run.mockResolvedValue({dry:true,recipientCount:4});
  const response=await GET(new Request('https://example.test/api/cron/admin-sms?dry=1',{headers:{authorization:'Bearer synthetic-cron'}}));
  expect(await response.json()).toEqual({dry:true,recipientCount:4});
});
it('rejects unsigned callbacks and applies a verified complete receipt through the database RPC',async()=>{
  const {POST}=await import('@/app/api/webhooks/mobile-message/route');
  vi.stubEnv('MOBILE_MESSAGE_WEBHOOK_SECRET','synthetic-signing-secret');
  const raw=JSON.stringify({custom_ref:'00000000-0000-0000-0000-000000000001',message_id:'provider-1',to:'61400000001',part_number:1,total_parts:2,status:'delivered'});
  expect((await POST(new Request('https://example.test/api/webhooks/mobile-message',{method:'POST',body:raw}))).status).toBe(401);
  expect(fakes.rpc).not.toHaveBeenCalled();
  const timestamp=String(Math.floor(Date.now()/1000));
  const signature=createHmac('sha256','synthetic-signing-secret').update(timestamp+'.'+raw).digest('hex');
  fakes.rpc.mockResolvedValue({data:true,error:null});
  const response=await POST(new Request('https://example.test/api/webhooks/mobile-message',{method:'POST',body:raw,headers:{'X-MM-Timestamp':timestamp,'X-MM-Signature':signature}}));
  expect(response.status).toBe(200);
  expect(fakes.rpc).toHaveBeenCalledWith('report_admin_sms',{p_id:'00000000-0000-0000-0000-000000000001',p_message_id:'provider-1',p_phone:'61400000001',p_part:1,p_total:2,p_status:'delivered'});
});
