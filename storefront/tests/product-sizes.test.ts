import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { beforeAll, afterAll, it, expect } from 'vitest';

let db: PGlite;
const actor = 'operator@example.test';
const tiers = (price: number) => [{ pack_size: 1, label: '1 vial', price_cents: price }, { pack_size: 3, label: '3-pack', price_cents: price * 3 }];
beforeAll(async () => {
  db = new PGlite();
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls; create schema storage; create table storage.buckets(id text primary key,name text,public boolean);');
  for (const file of readdirSync('supabase/migrations').filter(f => f.endsWith('.sql')).sort()) await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'));
  await db.query('select admin_create_product($1,$2)', [JSON.stringify({ name: 'Size fixture', slug: 'size-fixture', sku: 'SIZE', status: 'active', variants: tiers(1000), initialStock: 9 }), actor]);
});
afterAll(async () => { await db.close(); });
const add = (label: string, overrides = {}) => db.query<{ result: { slug: string } }>('select admin_add_product_size($1,$2,$3) result', ['size-fixture', JSON.stringify({ currentLabel: '10 mg', label, variants: tiers(2000), initialStock: 6, ...overrides }), actor]);

it('creates a size under the same product with an independent stock pool and price', async () => {
  const result = await add('20 mg');
  const slug = result.rows[0].result.slug;
  const rows = (await db.query<{ slug: string; size_label: string; price_cents: number; on_hand: number }>(`select p.slug,p.size_label,v.price_cents,i.on_hand from products p join product_variants v on v.product_id=p.id join inventory i on i.variant_id=v.id where p.slug in ('size-fixture',$1) and v.pack_size=1 order by p.slug`, [slug])).rows;
  expect(rows).toEqual([{ slug: 'size-fixture', size_label: '10 mg', price_cents: 1000, on_hand: 9 }, { slug, size_label: '20 mg', price_cents: 2000, on_hand: 6 }]);
  expect((await db.query('select count(*)::int n from products child join products parent on parent.id=child.size_parent_id where parent.slug=$1', ['size-fixture'])).rows[0]).toEqual({ n: 1 });
});

it('rejects duplicate sizes regardless of spacing/case and rolls back invalid opening stock', async () => {
  await expect(add('20MG')).rejects.toThrow(/already|duplicate/i);
  await expect(add('10mg')).rejects.toThrow(/already|duplicate/i);
  await expect(add('30 mg', { initialStock: -1 })).rejects.toThrow();
  expect((await db.query("select count(*)::int n from products where size_label='30 mg'")).rows[0]).toEqual({ n: 0 });
});

it('reserves, pays and refunds the chosen size without consuming another size', async () => {
  const variant = (await db.query<{ id: string }>("select v.id from product_variants v join products p on p.id=v.product_id where p.size_label='20 mg' and v.pack_size=3")).rows[0].id;
  const order = (await db.query<{ r: { orderId: string } }>('select commerce_create_order($1) r', [JSON.stringify({ email: 'buyer@example.test', items: [{ variantId: variant, qty: 1 }], shippingCents: 0 })])).rows[0].r;
  const stock = async () => (await db.query("select p.size_label,i.on_hand,i.reserved from products p join product_variants v on v.product_id=p.id join inventory i on i.variant_id=v.id where p.size_label in ('10 mg','20 mg') and v.pack_size=1 order by p.size_label")).rows;
  expect(await stock()).toEqual([{ size_label: '10 mg', on_hand: 9, reserved: 0 }, { size_label: '20 mg', on_hand: 6, reserved: 3 }]);
  await db.query("select commerce_order_operation($1,'paid','{}')", [order.orderId]);
  expect(await stock()).toEqual([{ size_label: '10 mg', on_hand: 9, reserved: 0 }, { size_label: '20 mg', on_hand: 3, reserved: 0 }]);
  const item = (await db.query<{ id: string; product_name: string; variant_label: string }>('select id,product_name,variant_label from order_items where order_id=$1', [order.orderId])).rows[0];
  expect(`${item.product_name} ${item.variant_label}`).toContain('20 mg');
  await db.query("select commerce_order_operation($1,'refund_items',$2)", [order.orderId, JSON.stringify({ refunds: [{ itemId: item.id, qty: 1 }], idempotencyKey: 'size-refund', restock: true })]);
  expect(await stock()).toEqual([{ size_label: '10 mg', on_hand: 9, reserved: 0 }, { size_label: '20 mg', on_hand: 6, reserved: 0 }]);
});

it('saves size prices atomically, detects stale edits, and prevents cross-product changes', async () => {
  const child=(await db.query<{id:string;edit_version:number}>("select id,edit_version from products where size_label='20 mg'")).rows[0];
  const variants=(await db.query<{id:string;price_cents:number}>('select id,price_cents from product_variants where product_id=$1',[child.id])).rows.map(v=>({...v,price_cents:2200,threshold:5}));
  const save=(id=child.id,version=child.edit_version)=>db.query("select admin_save_product_size('size-fixture',$1,'20 mg',true,$2,$3,$4)",[id,JSON.stringify(variants),version,actor]);
  await save();
  await expect(save()).rejects.toThrow(/changed/i);
  await expect(save('00000000-0000-0000-0000-000000000099')).rejects.toThrow(/belong/i);
  expect((await db.query('select distinct price_cents from product_variants where product_id=$1',[child.id])).rows).toEqual([{price_cents:2200}]);
  const current=(await db.query<{edit_version:number}>('select edit_version from products where id=$1',[child.id])).rows[0].edit_version;
  await db.query("select admin_save_product_size('size-fixture',$1,'20 mg',false,$2,$3,$4)",[child.id,JSON.stringify(variants),current,actor]);
  expect((await db.query('select status,size_enabled from products where id=$1',[child.id])).rows[0]).toEqual({status:'draft',size_enabled:false});
  await db.exec("update products set name='Renamed fixture' where slug='size-fixture'");
  expect((await db.query('select status,name from products where id=$1',[child.id])).rows[0]).toEqual({status:'draft',name:'Renamed fixture'});
});

it('creates a labelled first size atomically and blocks public callers from size writes', async () => {
  await db.query('select admin_create_sized_product($1,$2)',[JSON.stringify({name:'Water fixture',slug:'size-water',sku:'SIZE-WATER',sizeLabel:'3 ml',variants:tiers(500),initialStock:2}),actor]);
  expect((await db.query("select size_label from products where slug='size-water'")).rows[0]).toEqual({size_label:'3 ml'});
  await expect(db.query('select admin_create_sized_product($1,$2)',[JSON.stringify({name:'Invalid',slug:'invalid-size',sku:'INVALID-SIZE',sizeLabel:' '.repeat(5),variants:tiers(500)}),actor])).rejects.toThrow();
  expect((await db.query("select id from products where slug='invalid-size'")).rows).toHaveLength(0);
  for(const role of ['anon','authenticated']){
    await db.exec(`set role ${role}`);
    try { await expect(add('30 mg')).rejects.toThrow(/permission/i); }
    finally { await db.exec('reset role'); }
  }
});

it('does not republish a retired pack when a size is hidden and shown again',async()=>{
  const child=(await db.query<{id:string;edit_version:number}>("select id,edit_version from products where size_label='10 mg'")).rows[0];
  await db.query('update product_variants set active=false where product_id=$1 and pack_size=3',[child.id]);
  const toggle=async(enabled:boolean)=>{
    const version=(await db.query<{edit_version:number}>('select edit_version from products where id=$1',[child.id])).rows[0].edit_version;
    await db.query("select admin_save_product_size('size-fixture',$1,'10 mg',$2,'[]',$3,$4)",[child.id,enabled,version,actor]);
  };
  await toggle(false);await toggle(true);
  expect((await db.query('select pack_size,active from product_variants where product_id=$1 order by pack_size',[child.id])).rows).toEqual([{pack_size:1,active:true},{pack_size:3,active:false}]);
});

it('identifies each stock lot pool by size while retaining its compound name',async()=>{
  const catalog=(await db.query<{r:{pools:{name:string;sizeLabel:string}[]}}>('select admin_lot_catalog() r')).rows[0].r;
  const pools=catalog.pools.filter(pool=>pool.name==='Renamed fixture');
  expect(pools.map(pool=>pool.sizeLabel).sort()).toEqual(['10 mg','20 mg']);
});

it('inherits parent visibility so hiding the peptide also blocks its size SKUs', async () => {
  await db.exec("update products set status='archived' where slug='size-fixture'");
  expect((await db.query("select distinct status from products where size_label in ('10 mg','20 mg')")).rows).toEqual([{ status: 'archived' }]);
});
it('duplicates the complete size group as a draft without stock, preserving hidden sizes and retired packs',async()=>{
 const result=(await db.query<{r:{slug:string}}>("select admin_duplicate_product_sizes('size-fixture',$1) r",[actor])).rows[0].r;
 const rows=(await db.query<{id:string;size_label:string;size_enabled:boolean;status:string}>(`select id,size_label,size_enabled,status from products where slug=$1 or size_parent_id=(select id from products where slug=$1) order by size_label`,[result.slug])).rows;
 expect(rows.map(({size_label,size_enabled,status})=>({size_label,size_enabled,status}))).toEqual([{size_label:'10 mg',size_enabled:true,status:'draft'},{size_label:'20 mg',size_enabled:false,status:'draft'}]);
 expect((await db.query('select sum(on_hand)::int n from inventory i join product_variants v on v.id=i.variant_id where v.product_id=any($1::uuid[])',[rows.map(row=>row.id)])).rows[0]).toEqual({n:0});
 expect((await db.query('select pack_size,active from product_variants where product_id=$1 order by pack_size',[rows[0].id])).rows).toEqual([{pack_size:1,active:true},{pack_size:3,active:false}]);
});
