import {beforeEach,it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({session:vi.fn(),rpc:vi.fn(),result:vi.fn(),eq:vi.fn(),or:vi.fn(),order:vi.fn(),limit:vi.fn()}));
vi.mock('@/lib/customer-auth/server',()=>({getCustomerSession:m.session}));
vi.mock('@/lib/supabase',()=>({supabaseAdmin:()=>({rpc:m.rpc,from:()=>({select:()=>chain})})}));
import {listCustomerOrders,parseOrderCursor} from '@/lib/customer-orders/queries';
const chain={eq:m.eq,or:m.or,order:m.order,limit:m.limit,then:(ok:(value:unknown)=>void)=>Promise.resolve(m.result()).then(ok)};
const row=(i:number)=>({id:`10000000-0000-0000-0000-${String(i).padStart(12,'0')}`,order_number:`ECL-${i}`,created_at:'2026-09-30T01:00:00+00:00',status:'paid',customer_user_id:'owner',subtotal_cents:100,discount_cents:0,shipping_cents:0,total_cents:100,refunded_cents:0,order_items:[]});
beforeEach(()=>{vi.clearAllMocks();m.session.mockResolvedValue({userId:'owner',email:'buyer@example.test'});m.rpc.mockResolvedValue({error:null});for(const fn of [m.eq,m.or,m.order,m.limit])fn.mockReturnValue(chain);m.result.mockReturnValue({data:Array.from({length:21},(_,i)=>row(21-i)),error:null});});
it('requires a session and paginates only that owner using a stable cursor',async()=>{
 const first=await listCustomerOrders();expect(first?.orders).toHaveLength(20);expect(parseOrderCursor(first?.nextCursor??undefined)).toEqual({at:'2026-09-30T01:00:00+00:00',id:row(2).id});expect(m.eq).toHaveBeenCalledWith('customer_user_id','owner');
 await listCustomerOrders(first!.nextCursor!);expect(m.or).toHaveBeenCalledWith(expect.stringContaining(`id.lt.${row(2).id}`));
 m.session.mockResolvedValue(null);expect(await listCustomerOrders()).toBeNull();
});
it('rejects injected cursors and cross-customer rows',async()=>{
 expect(parseOrderCursor(Buffer.from(JSON.stringify({at:'2026-09-30),customer_user_id.eq.victim',id:row(1).id})).toString('base64url'))).toBeNull();
 m.result.mockReturnValue({data:[{...row(1),customer_user_id:'someone-else'}],error:null});expect((await listCustomerOrders())?.orders).toEqual([]);
});
