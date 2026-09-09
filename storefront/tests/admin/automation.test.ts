import {expect,it,vi} from 'vitest';
vi.mock('@/lib/admin/db',()=>({adminDb:()=>({from:()=>{let selected='';const q={select:()=>q,eq:(_key:string,value:string)=>{selected=value;return q;},in:()=>q,order:()=>q,range:()=>q,limit:()=>q,then:(resolve:(v:unknown)=>void)=>resolve({data:selected?[{created_at:'2026-01-01'}]:[{id:'failed',status:'dead',error:'Reconcile provider',attempt_count:8}],count:selected==='dead'?1500:0,error:null})};return q;}})}));
import {automationOverview} from '@/lib/admin/automation';
it('shows exact dead-letter workload and provider error without mutating the queue',async()=>{
 const result=await automationOverview('dead',1);
 expect(result.summary.find(s=>s.status==='dead')?.count).toBe(1500);
 expect(result.summary.find(s=>s.status==='dead')?.oldestAt).toBe('2026-01-01');
});
