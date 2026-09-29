import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const {sideEffect}=vi.hoisted(()=>({sideEffect:vi.fn(()=>{throw Error('Business side effect attempted');})}));
vi.mock('@/lib/admin/auth',()=>({requireAdmin:async()=>({email:'admin@example.test',userId:'test',name:null})}));
vi.mock('@/lib/admin/db',()=>({adminDb:sideEffect}));
vi.mock('@/lib/admin/orders',()=>({markPaid:sideEffect,setStatus:sideEffect,reinstateOrder:sideEffect,cancelOrder:sideEffect,updateOrderTracking:sideEffect,updatePendingOrderItemQty:sideEffect,removeOrderItem:sideEffect}));
vi.mock('@/lib/admin/refunds',()=>({quoteRefund:sideEffect,commitReviewedRefund:sideEffect,settleRefund:sideEffect}));
vi.mock('@/lib/admin/fulfilment',()=>({registerStockLot:sideEffect,allocateOrderLots:sideEffect,previewCarrierCsv:sideEffect,commitCarrierRows:sideEffect}));
vi.mock('next/cache',()=>({revalidatePath:sideEffect}));
beforeEach(()=>{vi.stubEnv('VERCEL_ENV','preview');sideEffect.mockClear();});
afterEach(()=>vi.unstubAllEnvs());
const loaders:Record<string,()=>Promise<unknown>>={
  'orders/actions':()=>import('@/app/admin/(dashboard)/orders/actions'),
  'products/actions':()=>import('@/app/admin/(dashboard)/products/actions'),
  'orders/refund-actions':()=>import('@/app/admin/(dashboard)/orders/refund-actions'),
  'orders/fulfilment-actions':()=>import('@/app/admin/(dashboard)/orders/fulfilment-actions'),
  'customers/actions':()=>import('@/app/admin/(dashboard)/customers/actions'),
  'creators/actions':()=>import('@/app/admin/(dashboard)/creators/actions'),
};
it.each([
  ['orders/actions','confirmPayment',['test']],
  ['orders/actions','deleteOrder',['test','DELETE']],
  ['products/actions','adjustStock',['test',1]],
  ['products/actions','uploadProductImage',['test',new FormData()]],
  ['orders/refund-actions','commitRefund',['test',null,false,'token','key']],
  ['orders/fulfilment-actions','previewCarrier',['order,tracking']],
  ['customers/actions','sendStageNow',['person@example.test','welcome',0]],
  ['creators/actions','reviewCreatorApplication',[{id:'test',expectedRevision:0,status:'accepted',notes:''}]],
])('blocks direct action %s:%s independently of middleware',async(module,name,args)=>{
  const actions=await loaders[module]() as Record<string,(...args:unknown[])=>Promise<unknown>>;
  await expect(actions[name](...args)).rejects.toThrow(/read.only/i);
  expect(sideEffect).not.toHaveBeenCalled();
});
