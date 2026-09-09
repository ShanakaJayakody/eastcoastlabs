import { expect,it,vi } from 'vitest';
const m=vi.hoisted(()=>({insert:vi.fn(async()=>({error:null})),latest:vi.fn(async()=>({data:null,error:null}))}));
vi.mock('@/lib/admin/db',()=>({adminDb:()=>({from:()=>({insert:m.insert,select:()=>({eq:()=>({order:()=>({limit:()=>({maybeSingle:m.latest})})})})})})}));
import { recordCronRun,cronHealth } from '@/lib/admin/cron-runs';
it('records partial work failures as failed and makes the scheduler see a failure',async()=>{
 await expect(recordCronRun('email-outbox',async()=>({sent:4,failed:1}))).rejects.toThrow(/failed/i);
 expect(m.insert).toHaveBeenCalledWith(expect.objectContaining({status:'failed',detail:{sent:4,failed:1}}));
});
it('hourly jobs go overdue while daily jobs are still within schedule',async()=>{
 m.latest.mockResolvedValue({data:{job:'fixture',status:'ok',created_at:new Date(Date.now()-4*3600_000).toISOString()},error:null} as never);
 const health=await cronHealth();
 expect(health.find(j=>j.job==='email-outbox')?.state).toBe('overdue');
 expect(health.find(j=>j.job==='daily-brief')?.state).toBe('ok');
});
it('does not report healthy/never when the health query fails',async()=>{
 m.latest.mockResolvedValue({data:null,error:{message:'offline'}} as never);
 await expect(cronHealth()).rejects.toThrow(/health|offline/i);
});
it('treats terminal analytics delivery failures as failed cron work',async()=>{
 await expect(recordCronRun('email-outbox',async()=>({analytics:{accepted:1,failed:0,dead:1}}))).rejects.toThrow(/failed/i);
});
