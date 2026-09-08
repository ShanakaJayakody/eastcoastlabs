import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

export async function fulfilmentChecks({db,a,b,scalar,check,race,fixture,orderInput,create,operation}){
 await check('physical lot registration serializes its stock evidence cap',async()=>{
  const pool=await fixture(4);
  const register=client=>scalar(client,'select admin_register_stock_lot($1,$2,3,null,null,$3,$4) result',[pool,`SYN-${randomUUID()}`,'Synthetic labelled stock counted','audit@example.test']);
  const results=await race('select * from inventory where variant_id=$1 for update',[pool],()=>register(a),()=>register(b));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.match(results.find(r=>r.status==='rejected').reason.message,/physical stock evidence/);
  assert.equal(Number(await scalar(db,'select sum(units) result from stock_lots where pool_variant_id=$1',[pool])),3);
  assert.equal(await scalar(db,'select on_hand result from inventory where variant_id=$1',[pool]),4);
 });
 await check('two orders cannot allocate the same last physical lot units',async()=>{
  const pool=await fixture(4);
  const lot=await scalar(db,'select admin_register_stock_lot($1,$2,2,null,null,$3,$4) result',[pool,`SYN-${randomUUID()}`,'Synthetic lot packing evidence','audit@example.test']);
  const first=await create(db,orderInput(pool,{items:[{variantId:pool,qty:2}]}));
  const second=await create(db,orderInput(pool,{items:[{variantId:pool,qty:2}]}));
  await operation(db,first.orderId,'paid');await operation(db,second.orderId,'paid');
  const firstItem=await scalar(db,'select id result from order_items where order_id=$1',[first.orderId]);
  const secondItem=await scalar(db,'select id result from order_items where order_id=$1',[second.orderId]);
  const assign=(client,order,item)=>scalar(client,'select admin_allocate_order_lots($1,$2,$3,$4,$5,$6) result',[order,item,pool,JSON.stringify([{lotId:lot,units:2}]),'Counted into synthetic parcel','audit@example.test']);
  const results=await race('select * from inventory where variant_id=$1 for update',[pool],()=>assign(a,first.orderId,firstItem),()=>assign(b,second.orderId,secondItem));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(results.filter(r=>r.status==='rejected').length,1);
  assert.equal(Number(await scalar(db,'select sum(units) result from order_lot_allocations where lot_id=$1',[lot])),2);
  assert.equal(await scalar(db,'select on_hand result from inventory where variant_id=$1',[pool]),0);
 });
 await check('carrier token replay changes tracking once without opted-out email',async()=>{
  const pool=await fixture(1),order=await create(db,orderInput(pool));await operation(db,order.orderId,'paid');
  const preview=await scalar(db,'select admin_preview_carrier($1) result',[JSON.stringify([{orderNumber:order.orderNumber,trackingNumber:'SYNTHETIC-TRACK-123'}])]);
  assert(preview[0].token,JSON.stringify(preview));
  const commit=client=>scalar(client,'select admin_commit_carrier($1,false,$2) result',[JSON.stringify([preview[0].token]),'audit@example.test']);
  const results=await race('select id from orders where id=$1 for update',[order.orderId],()=>commit(a),()=>commit(b));
  assert(results.every(r=>r.status==='fulfilled'&&r.value[0].ok));
  assert.equal(await scalar(db,`select count(*)::int result from commerce_events where order_id=$1 and kind='shipped'`,[order.orderId]),1);
  assert.equal(await scalar(db,`select count(*)::int result from email_outbox where payload->>'order_id'=$1 and template='order_shipped'`,[order.orderId]),0);
  assert.deepEqual((await db.query('select status,tracking_number from orders where id=$1',[order.orderId])).rows[0],{status:'shipped',tracking_number:'SYNTHETIC-TRACK-123'});
 });
}
