import {beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({rpc:vi.fn(),auth:vi.fn(),revalidate:vi.fn()}));
vi.mock('@/lib/admin/db',()=>({adminDb:()=>({rpc:m.rpc})}));vi.mock('@/lib/admin/auth',()=>({requireAdmin:m.auth}));vi.mock('next/cache',()=>({revalidatePath:m.revalidate}));
import {saveOrderCosts} from '@/app/admin/(dashboard)/orders/cost-actions';
beforeEach(()=>{vi.clearAllMocks();m.auth.mockResolvedValue({email:'real-admin@example.test'});m.rpc.mockResolvedValue({data:{revision:1},error:null});});
it('requires authorization before any cost mutation',async()=>{m.auth.mockRejectedValue(new Error('Authentication required'));await expect(saveOrderCosts('order',{},0)).rejects.toThrow('Authentication required');expect(m.rpc).not.toHaveBeenCalled();});
it('rejects fractions and unknown expense fields before writing',async()=>{expect((await saveOrderCosts('order',{payment_cents:1.5},0)).ok).toBe(false);expect((await saveOrderCosts('order',{actor:'forged'},0)).ok).toBe(false);expect(m.rpc).not.toHaveBeenCalled();});
it('preserves explicit zero and authenticated actor; returns database errors honestly',async()=>{
 expect(await saveOrderCosts('order',{carrier_cents:0,payment_cents:null},0)).toMatchObject({ok:true,revision:1});
 expect(m.rpc).toHaveBeenCalledWith('admin_save_order_costs',{p_order:'order',p_costs:{carrier_cents:0,payment_cents:null},p_revision:0,p_actor:'real-admin@example.test'});
 m.rpc.mockResolvedValue({data:null,error:{message:'Costs changed'}});expect(await saveOrderCosts('order',{},0)).toEqual({ok:false,error:'Costs changed'});
});

it('accepts signed integer-cent tax adjustments and rejects fractional or out-of-range corrections',async()=>{
 for(const tax_adjustment_cents of [-2147483648,-500,0,2147483647,null]) expect((await saveOrderCosts('order',{tax_adjustment_cents},0)).ok).toBe(true);
 m.rpc.mockClear();
 for(const tax_adjustment_cents of [-2147483649,2147483648,1.5,'5',Infinity]) expect((await saveOrderCosts('order',{tax_adjustment_cents},0)).ok).toBe(false);
 expect(m.rpc).not.toHaveBeenCalled();
});
