import {beforeEach,expect,it,vi} from 'vitest';
const {health,from}=vi.hoisted(()=>({health:vi.fn(),from:vi.fn()}));
vi.mock('@/lib/admin/cron-runs',()=>({cronHealth:health}));
vi.mock('@/lib/admin/db',()=>({adminDb:()=>({from})}));
import {GET} from '@/app/api/operations/health/route';
beforeEach(()=>{
 vi.clearAllMocks();
 process.env.CRON_SECRET='synthetic-monitor-secret';
 health.mockResolvedValue([{job:'email-outbox',state:'ok',ageHours:1,last:{error:'private@example.test',detail:{recipient:'private@example.test'}}}]);
 const builder={select:vi.fn(),eq:vi.fn(),in:vi.fn(),lte:vi.fn(),lt:vi.fn(),then:undefined as unknown};
 for(const key of ['select','eq','in','lte','lt'] as const)builder[key].mockReturnValue(builder);
 builder.then=(resolve:(value:unknown)=>void)=>resolve({count:0,error:null});from.mockReturnValue(builder);
});
it('rejects unauthenticated probes before database access',async()=>{
 const result=await GET(new Request('https://example.test/api/operations/health'));
 expect(result.status).toBe(401);expect(health).not.toHaveBeenCalled();expect(from).not.toHaveBeenCalled();
});
it('returns only aggregate health and never cron payloads or recipient details',async()=>{
 const result=await GET(new Request('https://example.test/api/operations/health',{headers:{authorization:'Bearer synthetic-monitor-secret'}}));
 expect(result.status).toBe(200);expect(result.headers.get('cache-control')).toContain('no-store');
 const text=await result.text();expect(text).not.toContain('private@example.test');expect(text).toContain('email-outbox');
});
it('fails closed for overdue jobs and redacts database failures',async()=>{
 health.mockResolvedValue([{job:'email-outbox',state:'overdue',ageHours:4}]);
 const request=()=>new Request('https://example.test/api/operations/health',{headers:{authorization:'Bearer synthetic-monitor-secret'}});
 expect((await GET(request())).status).toBe(503);
 health.mockRejectedValue(new Error('secret database credentials'));
 const result=await GET(request());expect(result.status).toBe(503);expect(await result.text()).not.toContain('secret database credentials');
});
