import {beforeEach,it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({session:vi.fn(),row:vi.fn(),eq:vi.fn(),cookies:new Map<string,string>()}));
vi.mock('next/headers',()=>({cookies:async()=>({get:(key:string)=>({value:m.cookies.get(key)})})}));
vi.mock('@/lib/customer-auth/server',()=>({getCustomerSession:m.session}));
vi.mock('@/lib/supabase',()=>({supabaseAdmin:()=>({from:()=>({select:()=>({eq:m.eq})})})}));
import {getCustomerOrder} from '@/lib/customer-orders/queries';
import {createOrderViewToken,verifyOrderViewToken,createOrderCookie,orderCookieName} from '@/lib/customer-orders/tokens';
const id='10000000-0000-0000-0000-000000000099';
const base={id,order_number:'ECL-1',status:'paid',created_at:'2026-09-30',customer_user_id:'owner',customer_email:'private@example.test',shipping_address:{address1:'Private street'},order_access_version:2,subtotal_cents:100,discount_cents:0,shipping_cents:0,total_cents:100,refunded_cents:0,order_items:[]};
beforeEach(()=>{vi.clearAllMocks();m.cookies.clear();vi.stubEnv('ORDER_ACCESS_SECRET','k'.repeat(32));m.session.mockResolvedValue(null);m.row.mockResolvedValue({data:base,error:null});m.eq.mockImplementation(()=>({eq:m.eq,maybeSingle:m.row}));});
it('bare IDs cannot query an order',async()=>{expect(await getCustomerOrder(id)).toBeNull();expect(m.row).not.toHaveBeenCalled();});
it('an order cookie is version checked and never reveals the private receipt',async()=>{
 m.cookies.set(orderCookieName(id),createOrderCookie(verifyOrderViewToken(createOrderViewToken(id,2))!));
 const order=await getCustomerOrder(id);expect(order?.privateDetails).toBeNull();expect(JSON.stringify(order)).not.toContain('private@example');
 expect(m.eq).toHaveBeenCalledWith('order_access_version',2);
 m.row.mockResolvedValue({data:{...base,order_access_version:3},error:null});expect(await getCustomerOrder(id)).toBeNull();
});
it('a signed-in customer must own this exact order to see personal details',async()=>{
 m.session.mockResolvedValue({userId:'different',email:'different@example.test'});
 expect(await getCustomerOrder(id)).toBeNull();
 m.session.mockResolvedValue({userId:'owner',email:'private@example.test'});
 expect((await getCustomerOrder(id))?.privateDetails?.email).toBe('private@example.test');
 expect(m.eq).toHaveBeenCalledWith('customer_user_id','owner');
});
