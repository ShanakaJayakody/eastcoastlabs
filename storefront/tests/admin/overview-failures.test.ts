import {beforeEach,expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({fail:''}));
vi.mock('@/lib/admin/db',()=>({adminDb:()=>({from:(table:string)=>{
 const result={data:[],count:0,error:table===state.fail?{message:'read unavailable'}:null};
 const q:Record<string,unknown>={then:(resolve:(v:typeof result)=>unknown)=>Promise.resolve(result).then(resolve)};
 for(const key of ['select','in','eq','gte','lt','order','limit'])q[key]=()=>q;
 return q;
}})}));
vi.mock('@/lib/admin/products',()=>({listAllProducts:async()=>[],lowStockVariants:async()=>[]}));
import {anomalyNudges,attentionQueue} from '@/lib/admin/attention';
import {queuedEmailCount} from '@/lib/admin/email';
import {listAbandonedCarts} from '@/lib/admin/cart-recovery';
beforeEach(()=>{state.fail='';});
it.each(['orders','email_events','email_outbox','stock_notifications'])('never converts a %s query error to a business warning',async(table)=>{
 state.fail=table;await expect(anomalyNudges()).rejects.toThrow(/unavailable/);
});
it.each(['orders','reviews','stock_notifications'])('rejects partial %s priority reads',async(table)=>{
 state.fail=table;await expect(attentionQueue()).rejects.toThrow(/unavailable/);
});
it('propagates activity-panel email and recovery failures',async()=>{
 state.fail='email_outbox';await expect(queuedEmailCount()).rejects.toThrow(/unavailable/);
 state.fail='cart_sessions';await expect(listAbandonedCarts()).rejects.toThrow(/unavailable/);
});
