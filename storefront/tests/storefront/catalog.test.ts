import { beforeEach, expect, it, vi } from 'vitest';
const { db, rows } = vi.hoisted(() => ({ db: { from: vi.fn() }, rows: { value: [] as unknown[] } }));
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: () => db }));
vi.mock('@/lib/woo', () => ({ getProducts: () => Promise.resolve([{slug: 'legacy'}]) }));
import { getCatalog } from '@/lib/catalog';
beforeEach(() => { db.from.mockReturnValue({ select: () => ({ eq: () => ({ order: () => ({ range: () => Promise.resolve({data: rows.value, error: null}) }) }) }) }); });
it('keeps an intentionally empty active catalog empty', async () => { rows.value=[]; expect((await getCatalog()).products).toEqual([]); });
it('does not sell an inactive single variant or count its stock', async () => {
 rows.value=[{slug:'test',name:'Test',product_variants:[{pack_size:1,active:false,price_cents:100,inventory:{on_hand:10,reserved:0}}]}];
 expect((await getCatalog()).products).toEqual([]);
});
it('only offers packs that fit available vials', async () => {
 rows.value=[{slug:'test',name:'Test',product_variants:[1,3,6].map(pack_size => ({pack_size,active:true,price_cents:100*pack_size,inventory:pack_size===1?{on_hand:2,reserved:1}:null}))}];
 const p=(await getCatalog()).products[0]; expect(p.available).toBe(1); expect(p.tiers?.map(t=>t.vials)).toEqual([1]);
});
it('groups sizes into one product and preserves each size price, stock and checkout identity', async () => {
 const variant=(price:number,stock:number)=>({pack_size:1,label:'1 vial',active:true,price_cents:price,inventory:{on_hand:stock,reserved:0}});
 rows.value=[{id:'parent',slug:'test',name:'Test',size_label:'10 mg',product_variants:[variant(1000,0)],size_products:[
  {id:'child',slug:'test-size-20',name:'Test',size_label:'20 mg',status:'active',product_variants:[variant(1800,5)]},
  {id:'hidden',slug:'test-size-30',size_label:'30 mg',status:'draft',product_variants:[variant(2500,8)]},
 ]},{id:'child',size_parent_id:'parent',slug:'test-size-20',product_variants:[variant(1800,5)]}];
 const products=(await getCatalog()).products;
 expect(products).toHaveLength(1);
 expect(products[0].is_in_stock).toBe(true);
 expect(products[0].sizes?.map(s=>({label:s.label,slug:s.slug,price:s.priceMinor,available:s.available}))).toEqual([
  {label:'10 mg',slug:'test',price:'1000',available:0},{label:'20 mg',slug:'test-size-20',price:'1800',available:5},
 ]);
});
