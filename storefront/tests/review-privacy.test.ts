import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { it, expect } from "vitest";
it("public review reads cannot expose private order references or draft reviews", async () => {
 const db = new PGlite();
 try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
   create table reviews(id uuid, product_slug text, author text, location text, rating integer, title text, body text, verified boolean, status text, is_sample boolean, created_at timestamptz, order_id uuid);
   alter table reviews enable row level security;
   create policy published on reviews for select using(status='published');
   grant select on reviews to anon,authenticated;
   insert into reviews(title,status,order_id) values ('Visible','published',gen_random_uuid()),('Private','pending',gen_random_uuid());`);
  try { await db.exec(readFileSync("supabase/migrations/20260908090000_order_access_privacy.sql", "utf8")); } catch(e) { if (!(e instanceof Error && e.message.includes("ENOENT"))) throw e; }
  await db.exec("set role anon");
  expect((await db.query("select title from reviews")).rows).toEqual([{ title: "Visible" }]);
  await expect(db.query("select order_id from reviews")).rejects.toThrow(/permission denied/);
  await expect(db.query("select * from reviews")).rejects.toThrow(/permission denied/);
 } finally { await db.close(); }
});
