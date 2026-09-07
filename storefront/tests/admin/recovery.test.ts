import {it,expect,vi} from 'vitest';
const carts=[{email:'unpaid@test.local',status:'recovered',recovered_order_id:'pending',created_at:'2026-08-01',updated_at:'2026-08-02'},{email:'paid@test.local',status:'recovered',recovered_order_id:'paid',created_at:'2026-08-03',updated_at:'2026-08-04'},{email:'old@test.local',status:'recovered',recovered_order_id:'old',created_at:'2025-08-03',updated_at:'2025-08-04'}];
vi.mock('@/lib/admin/db',()=>({adminDb:()=>({from:(table:string)=>{
 let rows:Record<string,unknown>[]=table==='orders'?[{id:'pending',status:'pending',paid_at:null,total_cents:9000,refunded_cents:0},{id:'paid',status:'paid',paid_at:'2026-08-04',total_cents:5000,refunded_cents:1000}]:carts;let start=0,end=999;
 const q={select:()=>q,order:()=>q,eq:(k:string,v:unknown)=>{rows=rows.filter(r=>r[k]===v);return q;},gte:(k:string,v:string)=>{rows=rows.filter(r=>String(r[k])>=v);return q;},gt:()=>q,lt:(k:string,v:string)=>{rows=rows.filter(r=>String(r[k])<v);return q;},in:(k:string,vs:unknown[])=>{rows=rows.filter(r=>vs.includes(r[k]));return q;},limit:(n:number)=>{end=n-1;return q;},range:(a:number,b:number)=>{start=a;end=b;return q;},then:(resolve:(v:unknown)=>void)=>resolve({data:rows.slice(start,end+1),count:rows.length,error:null})};return q;
}})}));
import {listCartsFor} from '@/lib/admin/cart-recovery';
const range={startIso:'2026-08-01',endIso:'2026-09-01'};
it('recovery list uses same capture cohort as its period metrics',async()=>{
 expect((await listCartsFor('recovered',50,range)).map(r=>r.email)).not.toContain('old@test.local');
});
