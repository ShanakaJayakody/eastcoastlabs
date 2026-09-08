import {beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({rpc:vi.fn(),requireAdmin:vi.fn(),revalidate:vi.fn()}));
vi.mock('@/lib/admin/db',()=>({adminDb:()=>({rpc:m.rpc})}));
vi.mock('@/lib/admin/auth',()=>({requireAdmin:m.requireAdmin}));
vi.mock('next/cache',()=>({revalidatePath:m.revalidate}));
import {previewRefund,commitRefund,recordRefundSettlement} from '@/app/admin/(dashboard)/orders/refund-actions';
import {advanceStatus,bulkAdvanceStatus} from '@/app/admin/(dashboard)/orders/actions';
beforeEach(()=>{vi.clearAllMocks();m.requireAdmin.mockResolvedValue({email:'real-admin@example.test'});m.rpc.mockResolvedValue({data:{refundedCents:900,fullyRefunded:false},error:null})});
it('keeps quote inputs and authenticated actor on the database boundary',async()=>{
 await previewRefund('order',[{itemId:'item',qty:1}],false);
 expect(m.rpc).toHaveBeenLastCalledWith('commerce_refund_quote',{p_order:'order',p_selection:[{itemId:'item',qty:1}],p_restock:false});
 expect(await commitRefund('order',null,true,'token','key')).toMatchObject({ok:true,refundedCents:900});
 expect(m.rpc).toHaveBeenLastCalledWith('commerce_refund_commit',{p_order:'order',p_selection:null,p_restock:true,p_token:'token',p_key:'key',p_actor:'real-admin@example.test'});
 await recordRefundSettlement('order',900,'BANK','2026-01-01','settle');
 expect(m.rpc).toHaveBeenLastCalledWith('commerce_refund_settle',{p_order:'order',p_cents:900,p_reference:'BANK',p_transfer_date:'2026-01-01',p_key:'settle',p_actor:'real-admin@example.test'});
});
it('returns a stale-review instruction and never hides a database error as success',async()=>{
 m.rpc.mockResolvedValue({data:null,error:{message:'REFUND_PREVIEW_STALE'}});
 expect(await commitRefund('order',null,false,'token','key')).toEqual({ok:false,error:'REFUND_PREVIEW_STALE',stale:true});expect(m.revalidate).not.toHaveBeenCalled();
});
it('generic status actions cannot bypass reviewed refunds',async()=>{
 expect((await advanceStatus('order','refunded')).ok).toBe(false);
 expect((await bulkAdvanceStatus(['order'],'refunded')).ok).toBe(false);
 expect(m.rpc).not.toHaveBeenCalled();
});
it('rejects fractional cents and unauthenticated mutation without invoking the database',async()=>{
 expect((await recordRefundSettlement('order',1.5,'BANK','2026-01-01','key')).ok).toBe(false);
 m.requireAdmin.mockRejectedValue(new Error('Authentication required'));
 await expect(commitRefund('order',null,false,'token','key')).rejects.toThrow('Authentication required');expect(m.rpc).not.toHaveBeenCalled();
});
