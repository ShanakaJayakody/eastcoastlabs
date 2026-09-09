import {expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({eq:vi.fn(),single:vi.fn(),limit:vi.fn(async()=>({data:[],error:null}))}));
vi.mock('@/lib/supabase',()=>({supabaseAdmin:()=>({from:()=>({select:()=>({eq:m.eq})})})}));
import {getCatalogProduct} from '@/lib/catalog';
it('finds an active product directly by slug even when it is not in the listing page',async()=>{
 const q={eq:m.eq,limit:m.limit,maybeSingle:m.single};m.eq.mockReturnValue(q);
 m.single.mockResolvedValue({data:{slug:'beyond-first-page',name:'Published product',product_variants:[{active:true,pack_size:1,label:'1 vial',price_cents:1234,inventory:{on_hand:4,reserved:0}}]},error:null});
 expect((await getCatalogProduct('beyond-first-page'))?.name).toBe('Published product');
 expect(m.eq).toHaveBeenCalledWith('slug','beyond-first-page');expect(m.limit).not.toHaveBeenCalled();
});
