import { beforeEach,expect,it,vi } from 'vitest';
const mocks=vi.hoisted(()=>({admin:vi.fn(),rpc:vi.fn(),run:vi.fn()}));
vi.mock('@/lib/admin/auth',()=>({requireAdmin:mocks.admin}));
vi.mock('@/lib/admin/daily-sms',()=>({smsRpc:mocks.rpc,runDailyAdminSms:mocks.run}));
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}));
beforeEach(()=>{mocks.admin.mockReset().mockResolvedValue({email:'admin@example.test'});mocks.rpc.mockReset();mocks.run.mockReset()});
it('requires admin authorization for settings changes, previews and manual tests',async()=>{
  const actions=await import('@/app/admin/(dashboard)/settings/admin-sms-actions');
  mocks.admin.mockRejectedValue(new Error('Access denied'));
  await expect(actions.saveAdminSmsSettings({enabled:true,startHour:8})).rejects.toThrow('Access denied');
  await expect(actions.previewAdminSms()).rejects.toThrow('Access denied');
  await expect(actions.testAdminSms('61400000001','00000000-0000-0000-0000-000000000001')).rejects.toThrow('Access denied');
  expect(mocks.rpc).not.toHaveBeenCalled();expect(mocks.run).not.toHaveBeenCalled();
});
it('validates the schedule and includes the authenticated actor in the audited save',async()=>{
  const {saveAdminSmsSettings}=await import('@/app/admin/(dashboard)/settings/admin-sms-actions');
  expect(await saveAdminSmsSettings({enabled:true,startHour:24})).toMatchObject({ok:false});
  expect(mocks.rpc).not.toHaveBeenCalled();
  mocks.rpc.mockResolvedValue(null);
  expect(await saveAdminSmsSettings({enabled:true,startHour:8})).toEqual({ok:true});
  expect(mocks.rpc).toHaveBeenCalledWith('save_admin_sms_settings',{p_enabled:true,p_start_hour:8,p_actor:'admin@example.test'});
});
it('returns test acceptance separately from handset delivery and never claims disabled sending succeeded',async()=>{
  const {testAdminSms}=await import('@/app/admin/(dashboard)/settings/admin-sms-actions');
  mocks.run.mockResolvedValue({disabled:true});
  expect(await testAdminSms('61400000001','00000000-0000-0000-0000-000000000001')).toMatchObject({ok:false});
  mocks.run.mockResolvedValue({accepted:1});
  expect(await testAdminSms('61400000001','00000000-0000-0000-0000-000000000001')).toMatchObject({ok:true,message:'Test accepted by Mobile Message. Delivery will appear in the history.'});
});
