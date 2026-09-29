import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
export async function customerDatabase() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema storage; create table storage.buckets(id text primary key,name text,public boolean);
    create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);`);
  for (const file of readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort()) await db.exec(readFileSync(`supabase/migrations/${file}`,'utf8'));
  return db;
}
export const product='10000000-0000-0000-0000-000000000091';
export const variant='20000000-0000-0000-0000-000000000091';
export async function seedProduct(db:PGlite) {
  await db.query(`insert into products(id,slug,name,status,size_label,images) values($1,'customer-fixture','Research material','active','50 mg','[{"src":"/images/products/a.png","alt":"50 mg vial","email_src":"/images/products/a-email.jpg"}]')`,[product]);
  await db.query(`insert into product_variants(id,product_id,sku,pack_size,label,price_cents) values($1,$2,'CUSTOMER-50',1,'1 vial',5900)`,[variant,product]);
  await db.query(`insert into stock_movements(variant_id,qty,reason) values($1,100,'received')`,[variant]);
}
export async function createOrder(db:PGlite,email='buyer@example.test', extra:Record<string,unknown>={}) {
  const {rows}=await db.query<{r:{orderId:string;orderNumber:string}}>('select commerce_create_order($1) r',[JSON.stringify({email,paymentMethod:'bank_transfer',items:[{variantId:variant,qty:1}],shippingCents:1000,...extra})]);
  return rows[0].r;
}
