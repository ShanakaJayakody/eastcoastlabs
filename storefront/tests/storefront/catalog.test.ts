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
