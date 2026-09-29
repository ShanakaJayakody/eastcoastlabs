import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";

let db: PGlite;

const productId = "10000000-0000-0000-0000-000000000091";
const variantId = "20000000-0000-0000-0000-000000000091";

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean);
  `);
  for (const file of readdirSync("supabase/migrations").filter((name) => name.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
  }
});

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  await db.exec("begin");
  await db.exec(`
    insert into products(id,slug,name,status)
    values('${productId}','deletion-fixture','Deletion fixture','active');
    insert into product_variants(id,product_id,sku,pack_size,label,price_cents)
    values('${variantId}','${productId}','DELETE-FIXTURE',1,'1 vial',1000);
    insert into stock_movements(variant_id,qty,reason)
    values('${variantId}',10,'received');
  `);
});

afterEach(async () => {
  await db.exec("rollback");
});

it("permanently deletes a pending order and releases its active reservation", async () => {
  const order = (
    await db.query<{ id: string; order_number: string }>(`
      insert into orders(customer_email,status,stock_reserved,total_cents)
      values('delete@example.test','pending',true,2000)
      returning id,order_number
    `)
  ).rows[0];
  const item = (
    await db.query<{ id: string }>(`
      insert into order_items(order_id,variant_id,product_slug,product_name,variant_label,sku,unit_price_cents,qty,line_total_cents)
      values($1,$2,'deletion-fixture','Deletion fixture','1 vial','DELETE-FIXTURE',1000,2,2000)
      returning id
    `, [order.id, variantId])
  ).rows[0];
  await db.query("insert into order_stock_claims(item_id,pool_variant_id,units_per_item) values($1,$2,1)", [item.id, variantId]);
  await db.query("select reserve_stock($1,2)", [variantId]);

  const result = (
    await db.query<{ result: { id: string; orderNumber: string; status: string } }>(
      "select admin_delete_order($1,$2,$3) result",
      [order.id, order.order_number, "operator@example.test"],
    )
  ).rows[0].result;

  expect(result).toEqual({ id: order.id, orderNumber: order.order_number, status: "pending" });
  expect((await db.query("select id from orders where id=$1", [order.id])).rows).toHaveLength(0);
  expect((await db.query("select on_hand,reserved from inventory where variant_id=$1", [variantId])).rows[0]).toEqual({
    on_hand: 10,
    reserved: 0,
  });
  expect(
    (await db.query("select actor_email,action,entity_id,diff->>'orderNumber' order_number from admin_audit_log where action='order.delete'"))
      .rows[0],
  ).toEqual({
    actor_email: "operator@example.test",
    action: "order.delete",
    entity_id: order.id,
    order_number: order.order_number,
  });
});

it("deletes a canonical paid order while retaining immutable commerce and analytics evidence", async () => {
  const order = (
    await db.query<{ result: { orderId: string; orderNumber: string } }>(
      "select commerce_create_order($1::jsonb) result",
      [
        JSON.stringify({
          email: "canonical-delete@example.test",
          analyticsClientId: "123456.789012",
          items: [{ variantId, qty: 2 }],
          shippingCents: 0,
        }),
      ],
    )
  ).rows[0].result;
  await db.query("select commerce_order_operation($1,'paid',$2::jsonb)", [
    order.orderId,
    JSON.stringify({ actor: "operator@example.test" }),
  ]);
  await db.query("select commerce_order_operation($1,'refunded',$2::jsonb)", [
    order.orderId,
    JSON.stringify({ actor: "operator@example.test", restock: false }),
  ]);

  const eventsBefore = await db.query<{
    id: string;
    order_id: string;
    kind: string;
    payload: unknown;
    created_at: string;
  }>(
    "select id,order_id,kind,payload,created_at from commerce_events where order_id=$1 order by created_at,id",
    [order.orderId],
  );
  const analyticsBefore = await db.query<{
    id: string;
    order_id: string;
    commerce_event_id: string | null;
    event_kind: string;
    payload: unknown;
    occurred_at: string;
    created_at: string;
  }>(
    "select id,order_id,commerce_event_id,event_kind,payload,occurred_at,created_at from paid_analytics_outbox where order_id=$1 order by created_at,id",
    [order.orderId],
  );
  expect(eventsBefore.rows.map((row) => row.kind).sort()).toEqual(["created", "paid", "refunded"]);
  expect(analyticsBefore.rows.map((row) => row.event_kind).sort()).toEqual(["purchase", "refund"]);

  await db.query("select admin_delete_order($1,$2,$3)", [
    order.orderId,
    order.orderNumber,
    "operator@example.test",
  ]);

  expect((await db.query("select id from orders where id=$1", [order.orderId])).rows).toHaveLength(0);
  expect(
    (
      await db.query(
        "select id,order_id,kind,payload,created_at from commerce_events where order_id=$1 order by created_at,id",
        [order.orderId],
      )
    ).rows,
  ).toEqual(eventsBefore.rows);
  expect(
    (
      await db.query(
        "select id,order_id,commerce_event_id,event_kind,payload,occurred_at,created_at from paid_analytics_outbox where order_id=$1 order by created_at,id",
        [order.orderId],
      )
    ).rows,
  ).toEqual(analyticsBefore.rows);
});

it("deletes a paid order without reversing its physical stock ledger and retains lot evidence", async () => {
  const order = (
    await db.query<{ id: string; order_number: string }>(`
      insert into orders(customer_email,status,stock_settled,paid_at,total_cents)
      values('fulfilled@example.test','paid',true,now(),2000)
      returning id,order_number
    `)
  ).rows[0];
  const item = (
    await db.query<{ id: string }>(`
      insert into order_items(order_id,variant_id,product_slug,product_name,variant_label,sku,unit_price_cents,qty,line_total_cents)
      values($1,$2,'deletion-fixture','Deletion fixture','1 vial','DELETE-FIXTURE',1000,2,2000)
      returning id
    `, [order.id, variantId])
  ).rows[0];
  await db.query("insert into order_stock_claims(item_id,pool_variant_id,units_per_item) values($1,$2,1)", [item.id, variantId]);
  await db.query("insert into stock_movements(variant_id,qty,reason,order_id) values($1,-2,'sale',$2)", [variantId, order.id]);
  const lot = (
    await db.query<{ id: string }>(`
      insert into stock_lots(pool_variant_id,lot_code,units,evidence,actor_email)
      values($1,'LOT-DELETE',10,'Physical receipt evidence','operator@example.test')
      returning id
    `, [variantId])
  ).rows[0];
  await db.query("insert into order_lot_allocations(item_id,lot_id,units) values($1,$2,2)", [item.id, lot.id]);
  await db.query("insert into order_variable_costs(order_id,carrier_cents,updated_by) values($1,500,'operator@example.test')", [order.id]);

  await db.query("select admin_delete_order($1,$2,$3)", [order.id, order.order_number, "operator@example.test"]);

  expect((await db.query("select on_hand,reserved from inventory where variant_id=$1", [variantId])).rows[0]).toEqual({
    on_hand: 8,
    reserved: 0,
  });
  expect((await db.query("select qty,reason,order_id from stock_movements where order_id=$1", [order.id])).rows).toEqual([
    { qty: -2, reason: "sale", order_id: order.id },
  ]);
  expect(
    (
      await db.query(
        "select item_id,lot_id,units,order_id,order_number,item_snapshot->>'productName' product_name from order_lot_allocations where item_id=$1",
        [item.id],
      )
    ).rows,
  ).toEqual([
    {
      item_id: item.id,
      lot_id: lot.id,
      units: 2,
      order_id: order.id,
      order_number: order.order_number,
      product_name: "Deletion fixture",
    },
  ]);
  await db.exec("savepoint immutable_lot_evidence");
  await expect(db.query("update order_lot_allocations set units=3 where item_id=$1", [item.id])).rejects.toThrow(/immutable/i);
  await db.exec("rollback to savepoint immutable_lot_evidence");
  expect((await db.query("select order_id from order_variable_costs where order_id=$1", [order.id])).rows).toHaveLength(0);
});

it.each([
  { status: "paid", shipped: false, qty: 4 },
  { status: "shipped", shipped: true, qty: 2 },
])("preserves stock-lot registration capacity after deleting a $status allocated order", async ({ status, shipped, qty }) => {
  const order = (
    await db.query<{ id: string; order_number: string }>(
      `insert into orders(customer_email,status,stock_settled,paid_at,shipped_at,total_cents)
       values('lot-capacity@example.test',$1,true,now(),case when $2 then now() else null end,$3 * 1000)
       returning id,order_number`,
      [status, shipped, qty],
    )
  ).rows[0];
  const item = (
    await db.query<{ id: string }>(
      `insert into order_items(order_id,variant_id,product_slug,product_name,variant_label,sku,unit_price_cents,qty,line_total_cents)
       values($1,$2,'deletion-fixture','Deletion fixture','1 vial','DELETE-FIXTURE',1000,$3,$3 * 1000)
       returning id`,
      [order.id, variantId, qty],
    )
  ).rows[0];
  await db.query("insert into order_stock_claims(item_id,pool_variant_id,units_per_item) values($1,$2,1)", [item.id, variantId]);
  await db.query("insert into stock_movements(variant_id,qty,reason,order_id) values($1,$2,'sale',$3)", [
    variantId,
    -qty,
    order.id,
  ]);
  const lot = (
    await db.query<{ id: string }>(
      `insert into stock_lots(pool_variant_id,lot_code,units,evidence,actor_email)
       values($1,$2,10,'Original physical receipt','operator@example.test') returning id`,
      [variantId, `LOT-${status.toUpperCase()}`],
    )
  ).rows[0];
  await db.query("insert into order_lot_allocations(item_id,lot_id,units) values($1,$2,2)", [item.id, lot.id]);
  const receipt = (
    await db.query<{ id: string }>(
      "insert into stock_movements(variant_id,qty,reason) values($1,2,'received') returning id",
      [variantId],
    )
  ).rows[0];

  await db.exec("savepoint registration_before_delete");
  await db.query("select admin_register_stock_lot($1,$2,2,$3,null,$4,$5)", [
    variantId,
    `PREVIEW-${status.toUpperCase()}`,
    receipt.id,
    "New physical receipt",
    "operator@example.test",
  ]);
  await db.exec("rollback to savepoint registration_before_delete");

  await db.query("select admin_delete_order($1,$2,$3)", [order.id, order.order_number, "operator@example.test"]);

  if (!shipped) {
    expect(
      (
        await db.query(
          "select order_id,order_number,pool_variant_id,paid_unshipped_units from deleted_order_stock_capacity where order_id=$1",
          [order.id],
        )
      ).rows,
    ).toEqual([
      {
        order_id: order.id,
        order_number: order.order_number,
        pool_variant_id: variantId,
        paid_unshipped_units: qty,
      },
    ]);
    await db.exec("savepoint immutable_capacity_evidence");
    await expect(
      db.query("update deleted_order_stock_capacity set paid_unshipped_units=1 where order_id=$1", [order.id]),
    ).rejects.toThrow(/immutable/i);
    await db.exec("rollback to savepoint immutable_capacity_evidence");
  }

  await db.query("select admin_register_stock_lot($1,$2,2,$3,null,$4,$5)", [
    variantId,
    `NEW-${status.toUpperCase()}`,
    receipt.id,
    "New physical receipt",
    "operator@example.test",
  ]);
  expect((await db.query("select units from stock_lots where receipt_id=$1", [receipt.id])).rows).toEqual([{ units: 2 }]);

  await db.exec("savepoint over_capacity_after_delete");
  await expect(
    db.query("select admin_register_stock_lot($1,$2,1,null,null,$3,$4)", [
      variantId,
      `OVER-${status.toUpperCase()}`,
      "No additional physical receipt",
      "operator@example.test",
    ]),
  ).rejects.toThrow(/physical stock evidence/i);
  await db.exec("rollback to savepoint over_capacity_after_delete");
});

it("retains immutable refund, recovery, and legacy-pricing evidence after deleting the order", async () => {
  const order = (
    await db.query<{ id: string; order_number: string }>(`
      insert into orders(customer_email,status,stock_settled,paid_at,refunded_cents,total_cents)
      values('evidence@example.test','refunded',true,now(),2000,2000)
      returning id,order_number
    `)
  ).rows[0];
  const quote = (
    await db.query<{ token: string }>(`
      insert into refund_quotes(order_id,selection,restock,state,quote)
      values($1,'null',false,'{}','{"totalCents":2000}') returning token
    `, [order.id])
  ).rows[0];
  await db.query(
    `insert into refund_commits(order_id,operation_key,request,quote_token,result,actor_email)
     values($1,'refund-key','{}',$2,'{"refundedCents":2000}','operator@example.test')`,
    [order.id, quote.token],
  );
  await db.query(
    `insert into refund_settlements(order_id,amount_cents,transfer_reference,transfer_date,operation_key,actor_email)
     values($1,2000,'BANK-DELETE',current_date,'settlement-key','operator@example.test')`,
    [order.id],
  );
  await db.query(
    `insert into recovery_episodes(email,cart,subtotal_cents,state,closed_at,order_id)
     values('evidence@example.test','[]',2000,'order_created',now(),$1)`,
    [order.id],
  );
  await db.query(
    `insert into legacy_discount_customers(discount_id,email,source_order_id)
     select id,'evidence@example.test',$1 from discounts where code='ECLLEGACY'`,
    [order.id],
  );
  await db.query(
    `insert into carrier_previews(order_id,order_number,tracking_number,state)
     values($1,$2,'TRACK-DELETE','{}')`,
    [order.id, order.order_number],
  );

  await db.query("select admin_delete_order($1,$2,$3)", [order.id, order.order_number, "operator@example.test"]);

  expect((await db.query("select order_id from refund_quotes where order_id=$1", [order.id])).rows).toHaveLength(1);
  expect((await db.query("select order_id from refund_commits where order_id=$1", [order.id])).rows).toHaveLength(1);
  expect((await db.query("select order_id from refund_settlements where order_id=$1", [order.id])).rows).toHaveLength(1);
  expect((await db.query("select order_id from recovery_episodes where order_id=$1", [order.id])).rows).toHaveLength(1);
  expect((await db.query("select source_order_id from legacy_discount_customers where source_order_id=$1", [order.id])).rows).toHaveLength(1);
  expect((await db.query("select order_id from carrier_previews where order_id=$1", [order.id])).rows).toHaveLength(0);
});

it("detaches customer records and cancels unsent email when an order is deleted", async () => {
  const order = (
    await db.query<{ id: string; order_number: string }>(`
      insert into orders(customer_email,status,total_cents)
      values('customer@example.test','completed',1000)
      returning id,order_number
    `)
  ).rows[0];
  const review = (
    await db.query<{ id: string }>(`
      insert into reviews(product_slug,author,rating,title,body,verified,order_id)
      values('deletion-fixture','Customer',5,'Useful','Still useful after deletion',true,$1)
      returning id
    `, [order.id])
  ).rows[0];
  await db.query(
    `insert into cart_sessions(email,cart,subtotal_cents,status,recovered_order_id)
     values('customer@example.test','[]',1000,'recovered',$1)`,
    [order.id],
  );
  const mail = (
    await db.query<{ id: string }>(`
      insert into email_outbox(to_email,template,payload,related_type,related_id)
      values('customer@example.test','order_confirmation',jsonb_build_object('order_id',$1::text),'order','event:delete')
      returning id
    `, [order.id])
  ).rows[0];
  const legacyMail = (
    await db.query<{ id: string }>(`
      insert into email_outbox(to_email,template,payload,related_type,related_id)
      values('customer@example.test','payment_instructions',jsonb_build_object('order_number',$1::text),'order','legacy-delete')
      returning id
    `, [order.order_number])
  ).rows[0];

  await db.query("select admin_delete_order($1,$2,$3)", [order.id, order.order_number, "operator@example.test"]);

  expect((await db.query("select order_id,verified from reviews where id=$1", [review.id])).rows[0]).toEqual({
    order_id: null,
    verified: true,
  });
  expect((await db.query("select recovered_order_id from cart_sessions where email='customer@example.test'")).rows[0]).toEqual({
    recovered_order_id: null,
  });
  expect((await db.query("select status,error from email_outbox where id=$1", [mail.id])).rows[0]).toEqual({
    status: "cancelled",
    error: "Order deleted",
  });
  expect((await db.query("select status,error from email_outbox where id=$1", [legacyMail.id])).rows[0]).toEqual({
    status: "cancelled",
    error: "Order deleted",
  });
});

it("requires the exact order number without changing the order or reservation on mismatch", async () => {
  const order = (
    await db.query<{ id: string; order_number: string }>(`
      insert into orders(customer_email,status,stock_reserved,total_cents)
      values('guard@example.test','pending',true,1000)
      returning id,order_number
    `)
  ).rows[0];
  const item = (
    await db.query<{ id: string }>(`
      insert into order_items(order_id,variant_id,unit_price_cents,qty,line_total_cents)
      values($1,$2,1000,1,1000) returning id
    `, [order.id, variantId])
  ).rows[0];
  await db.query("insert into order_stock_claims(item_id,pool_variant_id,units_per_item) values($1,$2,1)", [item.id, variantId]);
  await db.query("select reserve_stock($1,1)", [variantId]);

  await db.exec("savepoint rejected_delete");
  await expect(
    db.query("select admin_delete_order($1,$2,$3)", [order.id, `${order.order_number}-WRONG`, "operator@example.test"]),
  ).rejects.toThrow(/exact order number/i);
  await db.exec("rollback to savepoint rejected_delete");

  expect((await db.query("select status from orders where id=$1", [order.id])).rows[0]).toEqual({ status: "pending" });
  expect((await db.query("select reserved from inventory where variant_id=$1", [variantId])).rows[0]).toEqual({ reserved: 1 });
  expect((await db.query("select id from admin_audit_log where action='order.delete' and entity_id=$1", [order.id])).rows).toHaveLength(0);
});

it("rejects deletion without an authenticated actor", async () => {
  const order = (
    await db.query<{ id: string; order_number: string }>(`
      insert into orders(customer_email,status,total_cents)
      values('actor-guard@example.test','cancelled',1000)
      returning id,order_number
    `)
  ).rows[0];

  await db.exec("savepoint rejected_actor");
  await expect(db.query("select admin_delete_order($1,$2,$3)", [order.id, order.order_number, " "])).rejects.toThrow(
    /authenticated actor/i,
  );
  await db.exec("rollback to savepoint rejected_actor");

  expect((await db.query("select id from orders where id=$1", [order.id])).rows).toHaveLength(1);
});

it.each(["processing", "shipped"])("deletes an order in %s status", async (status) => {
  const order = (
    await db.query<{ id: string; order_number: string }>(`
      insert into orders(customer_email,status,stock_settled,paid_at,total_cents)
      values('status@example.test',$1,true,now(),1000)
      returning id,order_number
    `, [status])
  ).rows[0];

  await db.query("select admin_delete_order($1,$2,$3)", [order.id, order.order_number, "operator@example.test"]);

  expect((await db.query("select id from orders where id=$1", [order.id])).rows).toHaveLength(0);
});

it("allows only the service role to execute permanent deletion", async () => {
  const order = (
    await db.query<{ id: string; order_number: string }>(`
      insert into orders(customer_email,status,total_cents)
      values('role-guard@example.test','cancelled',1000)
      returning id,order_number
    `)
  ).rows[0];

  for (const role of ["anon", "authenticated"]) {
    await db.exec(`savepoint denied_${role}; set role ${role}`);
    await expect(
      db.query("select admin_delete_order($1,$2,$3)", [order.id, order.order_number, "operator@example.test"]),
    ).rejects.toThrow(/permission denied/i);
    await db.exec(`rollback to savepoint denied_${role}; reset role`);
  }

  await db.exec("set role service_role");
  await db.query("select admin_delete_order($1,$2,$3)", [order.id, order.order_number, "operator@example.test"]);
  await db.exec("reset role");
  expect((await db.query("select id from orders where id=$1", [order.id])).rows).toHaveLength(0);
});

it("keeps active lot allocations referentially guarded after evidence detachment is introduced", async () => {
  const lot = (
    await db.query<{ id: string }>(`
      insert into stock_lots(pool_variant_id,lot_code,units,evidence,actor_email)
      values($1,'LOT-GUARD',10,'Physical receipt evidence','operator@example.test')
      returning id
    `, [variantId])
  ).rows[0];

  await db.exec("savepoint invalid_allocation");
  await expect(
    db.query(
      "insert into order_lot_allocations(item_id,lot_id,units) values('00000000-0000-0000-0000-000000000099',$1,1)",
      [lot.id],
    ),
  ).rejects.toThrow(/order item/i);
  await db.exec("rollback to savepoint invalid_allocation");
});

it("indexes retained stock-capacity evidence by the pool used for lot registration", async () => {
  expect(
    (
      await db.query(
        "select indexname from pg_indexes where schemaname='public' and tablename='deleted_order_stock_capacity' and indexdef ilike '%(pool_variant_id)%'",
      )
    ).rows,
  ).toHaveLength(1);
});
