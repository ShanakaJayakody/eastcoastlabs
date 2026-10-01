import { beforeAll,afterAll,it,expect } from 'vitest';
import type {PGlite} from '@electric-sql/pglite';
import {customerDatabase,seedProduct,createOrder} from './customer-orders/database';
let db:PGlite;
const user='30000000-0000-0000-0000-000000000091';
beforeAll(async()=>{db=await customerDatabase();await seedProduct(db);await db.query(`insert into auth.users(id,email,email_confirmed_at) values($1,'buyer@example.test',now())`,[user]);});
afterAll(async()=>db.close());
it('claims only matching guest orders for a confirmed auth identity',async()=>{
 const mine=await createOrder(db),other=await createOrder(db,'different@example.test');
 await db.query('select customer_claim_orders($1)',[user]);
 const rows=(await db.query<{id:string;customer_user_id:string|null}>('select id,customer_user_id from orders where id in ($1,$2)',[mine.orderId,other.orderId])).rows;
 expect(rows.find(r=>r.id===mine.orderId)?.customer_user_id).toBe(user);
 expect(rows.find(r=>r.id===other.orderId)?.customer_user_id).toBeNull();
});
it('rejects an unverified identity and public callers',async()=>{
 const id='30000000-0000-0000-0000-000000000092';
 await db.query(`insert into auth.users(id,email) values($1,'different@example.test')`,[id]);
 await expect(db.query('select customer_claim_orders($1)',[id])).rejects.toThrow(/verified/i);
 await db.exec('set role authenticated');
 try{await expect(db.query('select customer_claim_orders($1)',[user])).rejects.toThrow(/permission/i);}finally{await db.exec('reset role');}
});
it('limits requests and verification attempts persistently',async()=>{
 const {rows}=await db.query<{id:string}>(`select customer_begin_login('limit@example.test','ip-one') id`);
 await expect(db.query(`select customer_begin_login('limit@example.test','ip-one')`)).rejects.toThrow(/rate/i);
 for(let i=0;i<5;i++){
  const r=await db.query<{r:{lease:string}}>('select customer_reserve_verification($1) r',[rows[0].id]);
  expect(r.rows[0].r.lease).toBeTruthy();
  await db.query('select customer_finish_verification($1,$2)',[rows[0].id,r.rows[0].r.lease]);
 }
 await expect(db.query('select customer_reserve_verification($1)',[rows[0].id])).rejects.toThrow(/expired|attempt/i);
});
it('binds a session to a verified reserved challenge and enforces idle/absolute expiry',async()=>{
 const challenge=(await db.query<{id:string}>(`select customer_begin_login('buyer@example.test','ip-two') id`)).rows[0].id;
 const lease=(await db.query<{r:{lease:string}}>('select customer_reserve_verification($1) r',[challenge])).rows[0].r.lease;
 await db.query('select customer_complete_login($1,$2,$3,$4)',[challenge,lease,user,'a'.repeat(64)]);
 expect((await db.query<{r:{user_id:string}}>('select customer_read_session($1) r',['a'.repeat(64)])).rows[0].r.user_id).toBe(user);
 await expect(db.query('select customer_complete_login($1,$2,$3,$4)',[challenge,lease,user,'b'.repeat(64)])).rejects.toThrow();
 await db.query(`update customer_sessions set last_seen_at=now()-interval '25 hours' where token_hash=$1`,['a'.repeat(64)]);
 expect((await db.query<{r:null}>('select customer_read_session($1) r',['a'.repeat(64)])).rows[0].r).toBeNull();
});
