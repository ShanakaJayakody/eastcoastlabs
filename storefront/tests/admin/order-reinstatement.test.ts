import { beforeEach, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ rpc:vi.fn(), load:vi.fn(), settings:vi.fn() }));
vi.mock('@/lib/admin/db',()=>({adminDb:()=>({rpc:m.rpc,from:()=>({select:()=>({eq:()=>({maybeSingle:m.load})})})})}));
vi.mock('@/lib/settings',()=>({getSettings:m.settings}));
import { reinstateOrder } from '@/lib/admin/orders';

beforeEach(() => {
  vi.clearAllMocks();
  m.rpc.mockResolvedValue({data:{reinstatedTo:'pending'},error:null});
  m.load.mockResolvedValue({data:{shipping_address:{shipping_method:'standard'}},error:null});
  m.settings.mockResolvedValue({paymentExpiryHours:48,standardShippingCents:1000,freeShippingThreshold:150,
    expressShippingEnabled:true,expressShippingCents:1500,expressFreeThreshold:250});
});
it.each([
  ['standard',true,1000,15000], ['express',true,1500,25000], ['express',false,1000,15000],
])('supplies the selected %s shipping policy (express enabled: %s)', async (method,enabled,baseCents,freeThresholdCents) => {
  m.load.mockResolvedValue({data:{shipping_address:{shipping_method:method}},error:null});
  m.settings.mockResolvedValue({...await m.settings(),expressShippingEnabled:enabled});
  expect(await reinstateOrder('order-id')).toEqual({reinstatedTo:'pending'});
  expect(m.rpc).toHaveBeenCalledWith('commerce_order_operation',expect.objectContaining({p_order:'order-id',p_action:'reinstate',p_options:expect.objectContaining({paymentExpiryHours:48,shippingPolicy:{baseCents,freeThresholdCents}})}));
});
it('stops before mutation when the shipping method cannot be loaded',async()=>{
  m.load.mockResolvedValue({data:null,error:{message:'unavailable'}});
  await expect(reinstateOrder('order-id')).rejects.toThrow(/load shipping method/);
  expect(m.rpc).not.toHaveBeenCalled();
});
