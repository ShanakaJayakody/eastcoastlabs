import {beforeEach,expect,it,vi} from 'vitest';
const {db,range,rows}=vi.hoisted(()=>{
 const rows=Array.from({length:1005},(_,i)=>({id:String(i),paid_at:'2026-09-29T00:00:00Z',total_cents:100}));
 const range=vi.fn();const db={from:vi.fn(),select:vi.fn(),not:vi.fn(),gte:vi.fn(),lt:vi.fn(),order:vi.fn(),range};
 return {db,range,rows};
});
vi.mock('@/lib/admin/db',()=>({adminDb:()=>db}));
import {getOverviewRevenue} from '@/lib/admin/overview/queries';
beforeEach(()=>{for(const key of ['from','select','not','gte','lt','order'] as const)db[key].mockReturnValue(db);range.mockImplementation((a:number,b:number)=>Promise.resolve({data:rows.slice(a,b+1),error:null}));});
it('reads every page with only non-PII paid facts',async()=>{
 const d=await getOverviewRevenue({kind:'today'},new Date('2026-09-29T02:00:00Z'));
 expect(d.totalCents).toBe(100500);expect(d.paidOrderCount).toBe(1005);
 expect(db.select).toHaveBeenCalledWith('id,paid_at,total_cents');expect(db.not).toHaveBeenCalledWith('paid_at','is',null);
});
it('fails visibly instead of returning a truncated total',async()=>{
 range.mockImplementation((a:number,b:number)=>Promise.resolve(a===500?{data:null,error:{message:'second page failed'}}:{data:rows.slice(a,b+1),error:null}));
 await expect(getOverviewRevenue({kind:'today'},new Date('2026-09-29T02:00:00Z'))).rejects.toThrow('second page failed');
});
