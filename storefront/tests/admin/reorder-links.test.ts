import {beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({rpc:vi.fn()}));vi.mock('@/lib/admin/db',()=>({adminDb:()=>({rpc:m.rpc})}));
import {reorderItems} from '@/lib/admin/reorder';
beforeEach(()=>{vi.clearAllMocks();m.rpc.mockResolvedValue({data:true,error:null});});
it('links the purchased catalogue product only when current stock logic confirms it is purchasable',async()=>{expect(await reorderItems([{product_name:'Sample',product_slug:'sample',variant_id:'sku',qty:2}])).toEqual([{name:'Sample',qty:2,url:'/product/sample'}]);m.rpc.mockResolvedValue({data:false,error:null});expect(await reorderItems([{product_name:'Sample',product_slug:'sample',variant_id:'sku',qty:2}])).toEqual([{name:'Sample',qty:2}]);});
it('rejects unsafe slug links and fails closed on availability errors',async()=>{expect(await reorderItems([{product_name:'Sample',product_slug:'../orders',variant_id:'sku',qty:2}])).toEqual([{name:'Sample',qty:2}]);expect(m.rpc).not.toHaveBeenCalled();m.rpc.mockResolvedValue({data:null,error:{message:'unavailable'}});await expect(reorderItems([{product_name:'Sample',product_slug:'sample',variant_id:'sku',qty:2}])).rejects.toThrow('unavailable');});
