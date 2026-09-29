import {beforeEach,it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({session:vi.fn(),rpc:vi.fn()}));
vi.mock('@/lib/customer-auth/server',()=>({getCustomerSession:m.session}));
vi.mock('@/lib/supabase',()=>({supabaseAdmin:()=>({rpc:m.rpc})}));
import {claimCheckoutOrders} from '@/lib/customer-auth/claim';
beforeEach(()=>{vi.clearAllMocks();m.session.mockResolvedValue({userId:'verified-user',email:'buyer@example.test'});m.rpc.mockResolvedValue({error:null});});
it('only claims orders for a checkout using the verified session mailbox',async()=>{
 await claimCheckoutOrders('different@example.test');expect(m.rpc).not.toHaveBeenCalled();
 await claimCheckoutOrders(' BUYER@example.test ');expect(m.rpc).toHaveBeenCalledWith('customer_claim_orders',{p_user:'verified-user'});
});
it('never turns a committed guest checkout into a failure when sessions or claims are unavailable',async()=>{
 m.session.mockRejectedValueOnce(new Error('Auth unavailable'));await expect(claimCheckoutOrders('buyer@example.test')).resolves.toBeUndefined();
 m.rpc.mockResolvedValueOnce({error:{message:'DB unavailable'}});await expect(claimCheckoutOrders('buyer@example.test')).resolves.toBeUndefined();
});
