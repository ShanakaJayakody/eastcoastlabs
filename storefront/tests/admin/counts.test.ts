import {beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock('@/lib/admin/db',()=>({adminDb:()=>({rpc:m.rpc})}));
import {orderStatusCounts} from '@/lib/admin/order-queries';

beforeEach(()=>{
 vi.clearAllMocks();
 m.rpc.mockResolvedValue({data:[{status:'pending',count:1501},{status:'paid',count:5},{status:'processing',count:2}],error:null});
});

it('uses one scoped aggregate for every order badge',async()=>{
 expect(await orderStatusCounts({search:'ECL,(buyer)',from:'2026-09-01',to:'2026-09-02',discount:' VIP_20 '})).toMatchObject({all:1508,pending:1501,paid:5,processing:2,to_fulfil:7,shipped:0,completed:0,cancelled:0,refunded:0});
 expect(m.rpc).toHaveBeenCalledWith('admin_order_status_counts',{
  p_search:'ECLbuyer',
  p_from:'2026-08-31T14:00:00.000Z',
  p_to:'2026-09-02T14:00:00.000Z',
  p_discount:'VIP_20',
 });
});
