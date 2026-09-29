import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const {effect}=vi.hoisted(()=>({effect:vi.fn(()=>{throw Error('External SMS operation attempted');})}));
vi.mock('@/lib/admin/db',()=>({adminDb:effect}));
vi.mock('@/lib/sms/worker',()=>({runSmsWorker:effect}));
import {runDailyAdminSms} from '@/lib/admin/daily-sms';
beforeEach(()=>{vi.stubEnv('VERCEL_ENV','preview');vi.stubEnv('ADMIN_SMS_ENABLED','true');effect.mockClear();});
afterEach(()=>vi.unstubAllEnvs());
it.each([{}, {dry:true}, {test:{phone:'61400000001',id:'00000000-0000-0000-0000-000000000001'}}])('blocks SMS service entry before database/provider access: %j',async options=>{
  await expect(runDailyAdminSms(new Date('2026-09-30T00:00:00Z'),options)).rejects.toThrow(/read.only/i);
  expect(effect).not.toHaveBeenCalled();
});
