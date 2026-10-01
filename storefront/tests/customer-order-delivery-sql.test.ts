import {beforeAll,afterAll,it,expect} from 'vitest';
import type {PGlite} from '@electric-sql/pglite';
import {customerDatabase,seedProduct,createOrder} from './customer-orders/database';
let db:PGlite;
beforeAll(async()=>{db=await customerDatabase();await seedProduct(db);});afterAll(async()=>db.close());
it('records carrier atomically before dispatch snapshots and rejects unrecognised carriers',async()=>{
 const o=await createOrder(db,'carrier@example.test');await db.query(`select commerce_order_operation($1,'paid','{}')`,[o.orderId]);
 await expect(db.query(`select commerce_order_operation($1,'shipped','{"trackingNumber":"X1","carrierCode":"madeup"}')`,[o.orderId])).rejects.toThrow(/carrier/i);
 await db.query(`select commerce_order_operation($1,'shipped','{"trackingNumber":"X1","carrierCode":"auspost","idempotencyKey":"ship"}')`,[o.orderId]);
 await db.query(`select commerce_order_operation($1,'shipped','{"trackingNumber":"X1","carrierCode":"auspost","idempotencyKey":"ship"}')`,[o.orderId]);
 const q=await db.query<{payload:{order_summary_v1:{carrier_code:string}}}>(`select payload from email_outbox where payload->>'order_id'=$1 and template='order_shipped'`,[o.orderId]);expect(q.rows).toHaveLength(1);expect(q.rows[0].payload.order_summary_v1.carrier_code).toBe('auspost');
});
it('revokes guest links and removes old account ownership after checkout-email correction',async()=>{
 const o=await createOrder(db,'old@example.test');const user='30000000-0000-0000-0000-000000000001';
 await db.query(`insert into auth.users(id,email,email_confirmed_at) values($1,'old@example.test',now())`,[user]);await db.query('select customer_claim_orders($1)',[user]);
 await db.query(`update orders set customer_email='corrected@example.test' where id=$1`,[o.orderId]);
 const q=await db.query<{order_access_version:number;customer_user_id:null;customer_claimed_at:null}>(`select order_access_version,customer_user_id,customer_claimed_at from orders where id=$1`,[o.orderId]);expect(q.rows[0]).toEqual({order_access_version:2,customer_user_id:null,customer_claimed_at:null});
 await db.query(`update email_outbox set to_email='corrected@example.test',rendered_html=null where payload->>'order_id'=$1`,[o.orderId]);
 const out=await db.query<{version:string}>(`select payload->'order_summary_v1'->>'access_version' version from email_outbox where payload->>'order_id'=$1`,[o.orderId]);expect(out.rows[0].version).toBe('2');
});
it('freezes optional provider fields once, including null, and leaves already-attempted legacy requests unchanged',async()=>{
 const o=await createOrder(db,'frozen@example.test');
 const q=await db.query<{id:string;lease_token:string}>(`select id,lease_token from claim_email_outbox(1,(select id from email_outbox where payload->>'order_id'=$1 limit 1))`,[o.orderId]);const r=q.rows[0];
 const freeze=async(text:string|null,reply:string|null)=> (await db.query<{r:Record<string,unknown>}>(`select prepare_email_delivery_v3($1,$2,'Subject','Body','Sender',$3,$4) r`,[r.id,r.lease_token,text,reply])).rows[0].r;
 expect(await freeze('Original text','support@example.test')).toMatchObject({text:'Original text',reply_to:'support@example.test'});
 expect(await freeze('Changed text','other@example.test')).toMatchObject({text:'Original text',reply_to:'support@example.test'});
 await db.query(`update email_outbox set rendered_text=null,rendered_reply_to=null,rendered_extras_frozen=false,provider_attempted_at=now() where id=$1`,[r.id]);
 expect(await freeze('New text','new@example.test')).toMatchObject({text:null,reply_to:null});
});
