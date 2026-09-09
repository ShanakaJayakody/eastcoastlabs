import {it,expect,vi} from 'vitest';
vi.mock('@/lib/admin/db',()=>({adminDb:()=>({from:()=>{let status:string|undefined;const q={select:()=>q,eq:(_k:string,v:string)=>{status=v;return q;},then:(resolve:(v:unknown)=>void)=>resolve({data:Array.from({length:1000},()=>({status:'pending'})),count:status==='pending'?1501:status==='paid'?5:0,error:null})};return q;}})}));
import {orderStatusCounts} from '@/lib/admin/order-queries';
it('order badge counts include every order beyond the API row cap',async()=>{
 expect(await orderStatusCounts()).toMatchObject({all:1506,pending:1501,paid:5,to_fulfil:5});
});
