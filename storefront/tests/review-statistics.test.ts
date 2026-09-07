import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
it('calculates full published-review counts without fetching a capped page of bodies',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role;
   create table reviews(product_slug text,rating integer,status text,created_at timestamptz);
   insert into reviews select 'test',case when i<=1000 then 1 else 5 end,'published',now() from generate_series(1,2001) i;
   insert into reviews values('test',1,'pending',now());`);
  try{await db.exec(readFileSync('supabase/migrations/20260908150000_review_statistics.sql','utf8'));}catch(e){if(!(e instanceof Error&&e.message.includes('ENOENT')))throw e;}
  const rows=(await db.query<{product_slug:string|null;count:number;rating:number}>(`select product_slug,count::int,rating::float from review_statistics(array['test'])`)).rows;
  expect(rows.find(r=>r.product_slug==='test')).toEqual({product_slug:'test',count:2001,rating:3});
  expect(rows.find(r=>r.product_slug===null)?.count).toBe(2001);
 }finally{await db.close();}
});
