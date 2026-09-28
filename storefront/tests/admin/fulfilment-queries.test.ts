import {beforeEach,expect,it,vi} from 'vitest';
const {rpc,gate}=vi.hoisted(()=>({rpc:vi.fn(),gate:vi.fn()}));
vi.mock('@/lib/admin/db',()=>({adminDb:()=>({rpc})}));
vi.mock('@/lib/admin/auth',()=>({requireAdmin:gate}));
import {getFulfilmentReport,orderTimingCsv,orderScope} from '@/lib/admin/fulfilment-analytics/queries';
import {parseFulfilmentParams} from '@/lib/admin/fulfilment-analytics/params';
import type {FulfilmentReport,TimingOrder} from '@/lib/admin/fulfilment-analytics/types';
import {GET} from '@/app/admin/(dashboard)/fulfilment/export/route';
const report={as_of:'2026-09-27T04:00:00Z',from:'2026-08-10',to:'2026-09-27',periods:[{key:'2026-09-21',start_at:'2026-09-20T14:00:00Z',end_at:'2026-09-27T14:00:00Z'}]} as FulfilmentReport;
const row=(i:number)=>({id:String(i),order_number:`ECL-${i}`,customer_name:'=1+1',status:'shipped',created_at:'2026-09-01T00:00Z',paid_at:'2026-09-02T00:00Z',shipped_at:'2026-09-03T00:00Z',payment_seconds:86400,fulfilment_seconds:86400,total_seconds:172800,payment_wait_seconds:null,fulfilment_wait_seconds:null,total_wait_seconds:null,quality_issue:false}) as TimingOrder;
beforeEach(()=>{rpc.mockReset();gate.mockReset();});
it('keeps database failures visible instead of substituting zero metrics',async()=>{
 rpc.mockResolvedValue({data:null,error:{message:'Unavailable'}});
 await expect(getFulfilmentReport(parseFulfilmentParams({}))).rejects.toThrow('Unavailable');
});
it('selects the exact Sydney calendar bounds for a period drilldown',()=>{
 expect(orderScope(parseFulfilmentParams({view:'shipments',period:'2026-09-21'}),report)).toEqual({from:'2026-09-21',to:'2026-09-27'});
 expect(orderScope(parseFulfilmentParams({view:'waiting',period:'2026-09-21'}),report)).toEqual({from:null,to:null});
});
it('exports all 1005 records with raw intervals, escaped formulas, and a fixed report time',async()=>{
 rpc.mockImplementation(async(name,args)=>{
  if(name!=='admin_fulfilment_orders'||args.p_as_of!==report.as_of)throw Error('Wrong analytics query');
  return {error:null,data:{as_of:report.as_of,total:1005,rows:Array.from({length:Math.min(500,1005-args.p_offset)},(_,i)=>row(i+args.p_offset))}};
 });
 const csv=await orderTimingCsv(parseFulfilmentParams({view:'shipments'}),report);
 expect(csv.split('\n')).toHaveLength(1006);expect(csv).toContain('ECL-1004');expect(csv).toContain("'=1+1");expect(csv).toContain('86400,86400,172800');
});
it('fails rather than returning a truncated export when a later page is unexpectedly empty',async()=>{
 rpc.mockResolvedValueOnce({error:null,data:{total:1005,rows:Array.from({length:500},(_,i)=>row(i))}}).mockResolvedValue({error:null,data:{total:1005,rows:[]}});
 await expect(orderTimingCsv(parseFulfilmentParams({view:'shipments'}),report)).rejects.toThrow(/changed|incomplete/i);
});
it('checks admin authorization before touching the export database',async()=>{
 gate.mockRejectedValue(new Error('Admin access required'));
 await expect(GET(new Request('https://example.test/admin/fulfilment/export?kind=orders'))).rejects.toThrow('Admin access required');
 expect(rpc).not.toHaveBeenCalled();
});
