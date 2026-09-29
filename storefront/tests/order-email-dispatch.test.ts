import {beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({rpc:vi.fn(),dispatch:vi.fn(),after:vi.fn(),lookup:vi.fn(),callbacks:[] as (()=>Promise<void>)[]}));
vi.mock('next/server',()=>({after:m.after}));
vi.mock('@/lib/admin/db',()=>({adminDb:()=>({rpc:m.rpc,from:()=>({select:()=>({in:m.lookup})})})}));
vi.mock('@/lib/settings',()=>({getSettings:async()=>({paymentExpiryHours:48,standardShippingCents:500,freeShippingThreshold:150})}));
vi.mock('@/lib/email/sender',()=>({dispatchOrderEmails:m.dispatch}));
import {createOrder,markPaid,setStatus,updateOrderTracking} from '@/lib/admin/orders';
import {commitCarrierRows} from '@/lib/admin/fulfilment';
beforeEach(()=>{vi.clearAllMocks();m.callbacks.length=0;m.after.mockImplementation(cb=>m.callbacks.push(cb));m.rpc.mockResolvedValue({data:{orderId:'order-1',changed:true,status:'paid'},error:null});m.dispatch.mockResolvedValue(undefined);});
it.each([
 ['create',()=>createOrder({email:'buyer@example.test',items:[]})],
 ['paid',()=>markPaid('order-1')],
 ['shipped',()=>setStatus('order-1','shipped',{trackingNumber:'TRACK'})],
 ['completed',()=>setStatus('order-1','completed')],
 ['tracking correction',()=>updateOrderTracking('order-1','NEW',{notify:true})],
] as const)('automatically starts delivery after a successful %s commit',async(_name,operation)=>{
 await operation();expect(m.callbacks).toHaveLength(1);expect(m.dispatch).not.toHaveBeenCalled();
 await m.callbacks[0]();expect(m.dispatch).toHaveBeenCalledWith('order-1');
});
it('never dispatches for a rolled-back order change',async()=>{
 m.rpc.mockResolvedValue({data:null,error:{message:'transaction failed'}});
 await expect(markPaid('order-1')).rejects.toThrow('transaction failed');expect(m.callbacks).toHaveLength(0);
});
it('dispatches successful carrier rows automatically, including replay, without sending failed rows',async()=>{
 m.rpc.mockResolvedValue({data:[{token:'a',ok:true},{token:'b',ok:false},{token:'c',ok:true,replayed:true}],error:null});
 m.lookup.mockResolvedValue({data:[{order_id:'order-a'},{order_id:'order-c'}],error:null});
 await commitCarrierRows(['a','b','c'],false,'admin@example.test');
 expect(m.callbacks).toHaveLength(1);await m.callbacks[0]();
 expect(m.lookup).toHaveBeenCalledWith('token',['a','c']);
 expect(m.dispatch.mock.calls).toEqual([['order-a'],['order-c']]);
});
it('keeps a committed order successful when scheduling or delivery fails',async()=>{
 const log=vi.spyOn(console,'error').mockImplementation(()=>{});
 m.after.mockImplementation(()=>{throw new Error('outside request');});await expect(markPaid('order-1')).resolves.toBeUndefined();
 m.after.mockImplementation(cb=>m.callbacks.push(cb));m.dispatch.mockRejectedValue(new Error('provider offline'));
 await markPaid('order-1');await expect(m.callbacks[0]()).resolves.toBeUndefined();expect(log).toHaveBeenCalled();
});
