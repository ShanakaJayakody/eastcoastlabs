import {beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({rpc:vi.fn(),read:vi.fn()}));
vi.mock('@/lib/admin/db',()=>({adminDb:()=>({rpc:m.rpc,from:()=>({select:()=>({eq:()=>({maybeSingle:m.read,eq:m.read})})})})}));
import {queueBackInStock,waitlistCount} from '@/lib/admin/notifications';
beforeEach(()=>{vi.clearAllMocks();m.rpc.mockResolvedValue({data:2,error:null});m.read.mockResolvedValue({data:null,count:null,error:{message:'database unavailable'}})});
it('returns only the durable RPC result',async()=>{expect(await queueBackInStock('variant')).toBe(2);expect(m.rpc).toHaveBeenCalledWith('queue_back_in_stock',{p_variant:'variant'})});
it('surfaces a failed claim instead of reporting zero successful notifications',async()=>{m.rpc.mockResolvedValue({data:null,error:{message:'database unavailable'}});await expect(queueBackInStock('variant')).rejects.toThrow('database unavailable')});
it('surfaces a failed waitlist count instead of displaying an empty list',async()=>{await expect(waitlistCount('sample')).rejects.toThrow('database unavailable')});
