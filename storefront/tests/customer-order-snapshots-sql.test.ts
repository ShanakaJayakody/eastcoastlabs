import { beforeAll, afterAll, it, expect } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { customerDatabase, seedProduct, createOrder, product } from './customer-orders/database';
let db:PGlite;
beforeAll(async()=>{db=await customerDatabase();await seedProduct(db);});
afterAll(async()=>{await db.close();});
it('keeps the purchased size, image and price after catalogue changes',async()=>{
 const o=await createOrder(db);
 await db.query(`update products set images='[{"src":"/images/products/b.png"}]' where id=$1`,[product]);
 const {rows}=await db.query<{item:Record<string,unknown>}>('select to_jsonb(i) item from order_items i where order_id=$1',[o.orderId]);
 expect(rows[0].item).toMatchObject({image_url_snapshot:'/images/products/a.png',email_image_url_snapshot:'/images/products/a-email.jpg',size_label_snapshot:'50 mg',unit_price_cents:5900});
 const q=await db.query<{payload:Record<string,unknown>}>('select payload from email_outbox where payload->>\'order_id\'=$1',[o.orderId]);
 expect(q.rows[0].payload.order_summary_v1).toMatchObject({total_cents:6900,items:[{image_url:'/images/products/a-email.jpg',size_label:'50 mg',line_total_cents:5900}]});
});
it('snapshots every milestone without duplicating event mail or reading current prices',async()=>{
 const o=await createOrder(db,'next@example.test');
 await db.query(`update product_variants set price_cents=9000 where product_id=$1`,[product]);
 await db.query(`select commerce_order_operation($1,'paid','{}')`,[o.orderId]);
 await db.query(`select commerce_order_operation($1,'paid','{}')`,[o.orderId]);
 const q=await db.query<{payload:Record<string,unknown>}>(`select payload from email_outbox where payload->>'order_id'=$1 and template='order_confirmation'`,[o.orderId]);
 expect(q.rows).toHaveLength(1);
 expect(q.rows[0].payload.order_summary_v1).toMatchObject({subtotal_cents:5900,total_cents:6900,items:[{line_total_cents:5900}]});
});
it('does not attach a receipt to a different email recipient',async()=>{
 const o=await createOrder(db,'owner@example.test');
 await db.query(`insert into email_outbox(to_email,template,payload) values('stranger@example.test','order_confirmation',$1)`,[JSON.stringify({order_id:o.orderId})]);
 const q=await db.query<{payload:Record<string,unknown>}>(`select payload from email_outbox where to_email='stranger@example.test'`);
 expect(q.rows[0].payload.order_summary_v1).toBeUndefined();
});
it('preserves gift labels and tolerates an extra item without a catalogue image',async()=>{
 const o=await createOrder(db,'gift@example.test',{extraItems:[{name:'Sample accessory',label:'Free gift',qty:1,unitPriceCents:0}]});
 const q=await db.query<{payload:{order_summary_v1?:{items:Record<string,unknown>[]}}}>(`select payload from email_outbox where payload->>'order_id'=$1`,[o.orderId]);
 expect(q.rows[0].payload.order_summary_v1?.items).toEqual(expect.arrayContaining([expect.objectContaining({name:'Sample accessory',is_gift:true,image_url:null,line_total_cents:0})]));
});
it('never mistakes inherited parent artwork for a purchased child size',async()=>{
 await db.query(`update products set images='[{"src":"/images/products/50mg.jpg","email_src":"/images/products/50mg-email.jpg","size_label":"50 mg"}]' where id=$1`,[product]);
 const added=await db.query<{r:{slug:string}}>('select admin_add_product_size($1,$2,$3) r',['customer-fixture',JSON.stringify({label:'100 mg',variants:[{pack_size:1,label:'1 vial',price_cents:10000}],initialStock:10}),'operator@example.test']);
 const childVariant=(await db.query<{id:string}>(`select v.id from product_variants v join products p on p.id=v.product_id where p.slug=$1 and v.pack_size=1`,[added.rows[0].r.slug])).rows[0].id;
 const buy=async()=> (await db.query<{r:{orderId:string}}>('select commerce_create_order($1) r',[JSON.stringify({email:'size@example.test',items:[{variantId:childVariant,qty:1}],shippingCents:0})])).rows[0].r;
 const first=await buy();
 const receipt=async(id:string)=>(await db.query<{image_url_snapshot:string|null;email_image_url_snapshot:string|null;size_label_snapshot:string}>(`select image_url_snapshot,email_image_url_snapshot,size_label_snapshot from order_items where order_id=$1`,[id])).rows[0];
 expect(await receipt(first.orderId)).toEqual({image_url_snapshot:null,email_image_url_snapshot:null,size_label_snapshot:'100 mg'});
 await db.query(`update products set images=images||'[{"src":"/images/products/100mg.jpg","email_src":"/images/products/100mg-email.jpg","size_label":"100 mg"}]'::jsonb where id=$1`,[product]);
 expect(await receipt((await buy()).orderId)).toEqual({image_url_snapshot:'/images/products/100mg.jpg',email_image_url_snapshot:'/images/products/100mg-email.jpg',size_label_snapshot:'100 mg'});
 expect(await receipt(first.orderId)).toEqual({image_url_snapshot:null,email_image_url_snapshot:null,size_label_snapshot:'100 mg'});
});
