import { PGlite } from '@electric-sql/pglite';
import { readFileSync,readdirSync } from 'node:fs';
import { expect,it } from 'vitest';
it('applies the complete migration chain to an isolated database with restricted public roles',async()=>{
 const db=new PGlite();
 try {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
   create schema storage;create table storage.buckets(id text primary key,name text,public boolean);`);
  for(const file of readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort()) {
   try {await db.exec(readFileSync(`supabase/migrations/${file}`,'utf8'));}
   catch(e){throw new Error(`Migration ${file}: ${e instanceof Error?e.message:String(e)}`);}
  }
  await db.exec('set role anon');
  await expect(db.query(`select commerce_create_order('{}')`)).rejects.toThrow(/permission denied/);
  await expect(db.query(`select * from email_outbox`)).rejects.toThrow(/permission denied/);
  await expect(db.query(`select order_id from reviews`)).rejects.toThrow(/permission denied/);
  await expect(db.query(`select admin_settings_snapshot()`)).rejects.toThrow(/permission denied/);
 }finally{await db.close();}
});
