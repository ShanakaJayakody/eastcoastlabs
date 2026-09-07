import {it,expect,vi} from 'vitest';
const customers=Array.from({length:1007},(_,i)=>({email:`person${String(i).padStart(4,'0')}@test.local`,name:`Person ${i}`,orders_count:1,ltv_cents:100,last_order_at:null}));
vi.mock('@/lib/admin/db',()=>({adminDb:()=>({from:(table:string)=>{
 let start=0,end=999;
 const q={select:()=>q,order:()=>q,eq:()=>q,limit:(n:number)=>{end=n-1;return q;},range:(a:number,b:number)=>{start=a;end=b;return q;},then:(resolve:(v:unknown)=>void)=>resolve({data:(table==='customers'?customers:[]).slice(start,end+1),error:null})};return q;
}})}));
import {listPeople,filterPeople,peopleCsv,segmentCounts} from '@/lib/admin/people';
it('search, segments and export cover people beyond first 1000 with stable ties',async()=>{
 const rows=await listPeople();
 expect(filterPeople(rows,'all','person1006')).toHaveLength(1);
 expect(segmentCounts(rows).all).toBe(1007);
 expect(peopleCsv(rows).split('\n')).toHaveLength(1008);
 expect(rows[1006].email).toBe('person1006@test.local');
});
