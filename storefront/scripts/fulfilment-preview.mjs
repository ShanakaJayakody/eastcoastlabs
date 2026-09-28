// Generate synthetic browser fixtures using the same SQL as production.
import {PGlite} from '@electric-sql/pglite';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
const db=new PGlite();
await db.exec('create role anon; create role authenticated; create role service_role bypassrls; create schema storage; create table storage.buckets(id text primary key,name text,public boolean)');
for(const f of readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync(`supabase/migrations/${f}`,'utf8'));
await db.exec(`insert into orders(order_number,customer_email,customer_name,status,created_at,paid_at,shipped_at)
 select 'DEMO-'||i,'synthetic@example.test','Sample customer '||i,'shipped',
 '2026-08-10 00:00Z'::timestamptz+i*interval '18 hours',
 '2026-08-10 00:00Z'::timestamptz+i*interval '18 hours'+(i%6)*interval '5 hours',
 '2026-08-10 00:00Z'::timestamptz+i*interval '18 hours'+(i%6)*interval '5 hours'+(i%10+1)*interval '5 hours' from generate_series(1,54) i;
 insert into orders(order_number,customer_email,customer_name,status,created_at,paid_at)
 select 'DEMO-W'||i,'synthetic@example.test','Waiting customer '||i,case when i%2=0 then 'paid' else 'processing' end,
 '2026-09-27 04:00Z'::timestamptz-(i+2)*interval '24 hours','2026-09-27 04:00Z'::timestamptz-i*interval '24 hours' from generate_series(1,4) i;
 insert into orders(order_number,customer_email,status,created_at) values('DEMO-P1','synthetic@example.test','pending','2026-09-25 04:00Z');`);
const at='2026-09-27T04:00:00Z';
const reports={};for(const grain of ['week','month'])reports[grain]=(await db.query("select admin_fulfilment_report($1,'all',null,null,$2) r",[grain,at])).rows[0].r;
const views={};for(const view of ['waiting','unpaid','payments','shipments','quality'])views[view]=(await db.query("select admin_fulfilment_orders($1,null,null,$3,'desc',0,500,$2,null) r",[view,at,['waiting','unpaid'].includes(view)?'wait':'milestone'])).rows[0].r;
writeFileSync('tests/preview/fulfilment-data.json',JSON.stringify({reports,views},null,2)+'\n');
await db.close();
console.log('Synthetic fulfilment preview fixtures generated.');
