import {beforeEach,it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({rpc:vi.fn(),from:vi.fn()}));
vi.mock('@/lib/admin/db',()=>({adminDb:()=>m}));
import {createProduct,addTiers} from '@/lib/admin/products';
beforeEach(()=>{vi.clearAllMocks();m.rpc.mockResolvedValue({data:{slug:'sample'},error:null});});
it('creates product, tiers, stock and audit via one transaction',async()=>{
 expect(await createProduct({name:'Sample',variants:[],initialStock:4},'operator@example.test')).toEqual({slug:'sample'});
 expect(m.from).not.toHaveBeenCalled();expect(m.rpc).toHaveBeenCalledOnce();expect(m.rpc.mock.calls[0][0]).toBe('admin_create_product');
 expect(m.rpc.mock.calls[0][1].p_input).toMatchObject({slug:'sample',initialStock:4,variants:expect.arrayContaining([{pack_size:1,label:'1 vial',price_cents:0}])});
});
it('launch errors surface without partial direct writes or an activation after failure',async()=>{
 m.rpc.mockResolvedValue({data:null,error:{message:'Synthetic tier constraint failed'}});
 await expect(addTiers('sample',{singlePriceCents:1000,initialStock:3,activate:true},'operator@example.test')).rejects.toThrow(/constraint/);
 expect(m.from).not.toHaveBeenCalled();expect(m.rpc.mock.calls[0][0]).toBe('admin_launch_product');
});
