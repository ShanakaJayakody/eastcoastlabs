import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import { runSmsWorker, type SmsWorkerDependencies } from '@/lib/sms/worker';
import type { FrozenSms } from '@/lib/sms/types';

let db:PGlite;
let deps:SmsWorkerDependencies;
let sent:FrozenSms[];
let alerts:string[];
let enabled=true;
// The worker clock is the database's current Melbourne morning; the database
// controls leases/expiry, while the worker's injected clock controls scheduling.
let now:Date;
beforeAll(async()=>{
  db=new PGlite();
  await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create schema storage;create table storage.buckets(id text primary key,name text,public boolean)');
  for(const f of readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync(`supabase/migrations/${f}`,'utf8'));
  const [{morning}]=(await db.query<{morning:string}>("select (((now() at time zone 'Australia/Melbourne')::date)::text||' 08:10 Australia/Melbourne')::timestamptz::text morning")).rows;
  now=new Date(morning);
});
afterAll(async()=>{await db.close()});
beforeEach(async()=>{
  await db.exec('begin;update admin_sms_settings set enabled=true');
  enabled=true;sent=[];alerts=[];
  deps={
    enabled:()=>enabled,
    settings:async()=>(await db.query('select enabled,start_hour from admin_sms_settings')).rows[0] as {enabled:boolean;start_hour:number},
    summary:async()=>({reportDate:'2026-09-29',asOf:now.toISOString(),month:'2026-09',yesterdayRevenueCents:123401,monthRevenueCents:456789,overdueFulfilment:60,lowStockNames:['Sema']}),
    recipients:async()=>[{contactId:1,name:'Alex',phone:'61400000001'},{contactId:2,name:'Sam',phone:'61400000002'}],
    balance:async()=>1042,
    config:()=>({sender:'61400000099',fingerprint:'a'.repeat(64)}),
    send:async(row)=>{sent.push(row);return {kind:'accepted',messageId:'provider-'+row.to_phone,credits:row.expected_parts}},
    alert:async(issue)=>{alerts.push(issue)},
    rpc:async(name,args)=>{
      const keys=Object.keys(args);
      // Keep database leases real while the injected worker clock exercises
      // the morning schedule independently of the time CI runs.
      if(name==='enqueue_admin_sms')args.p_expires=new Date(Date.now()+3600000).toISOString();
      const rows=(await db.query<Record<string,unknown>>(`select * from ${name}(${keys.map((key,i)=>`${key}=>$${i+1}`).join(',')})`,Object.values(args).map(v=>Array.isArray(v)&&typeof v[0]==='object'?JSON.stringify(v):v))).rows;
      return ['claim_admin_sms'].includes(name)?rows:rows[0]?.[name];
    },
  };
});
afterEach(async()=>{await db.exec('rollback')});
it('persists one daily delivery per phone across repeated workers and stores the agreed body',async()=>{
  expect(await runSmsWorker(now,{},deps)).toMatchObject({accepted:2,failed:0});
  expect(await runSmsWorker(now,{},deps)).toMatchObject({accepted:0,queued:0});
  expect(sent).toHaveLength(2);
  const rows=(await db.query<{body:string;status:string}>('select body,status from admin_sms_outbox')).rows;
  expect(rows.every(r=>r.status==='accepted'&&r.body.includes('Overdue Orders to fulfil: 60'))).toBe(true);
});
it('does no sending or persistence when disabled, paused, outside the window or previewing',async()=>{
  enabled=false;expect(await runSmsWorker(now,{},deps)).toMatchObject({disabled:true});
  enabled=true;await db.exec('update admin_sms_settings set enabled=false');
  expect(await runSmsWorker(now,{},deps)).toMatchObject({paused:true});
  await db.exec('update admin_sms_settings set enabled=true');
  expect(await runSmsWorker(new Date(now.getTime()+4*3600000),{},deps)).toMatchObject({outsideWindow:true});
  const preview=await runSmsWorker(now,{dry:true},deps);
  expect(preview).toMatchObject({dry:true,recipientCount:2});
  expect((await db.query('select id from admin_sms_outbox')).rows).toHaveLength(0);
  expect(sent).toHaveLength(0);
});
it('rechecks membership before sending and cancels removed recipients',async()=>{
  let reads=0;
  deps.recipients=async()=>++reads===1?[{contactId:1,name:'Alex',phone:'61400000001'}]:[{contactId:2,name:'Sam',phone:'61400000002'}];
  expect(await runSmsWorker(now,{},deps)).toMatchObject({accepted:0});
  expect((await db.query('select status from admin_sms_outbox')).rows).toEqual([{status:'cancelled'}]);
  expect(sent).toHaveLength(0);
});
it('retries an uncertain request using the original body and key',async()=>{
  let failures=1;
  deps.send=async(row)=>{sent.push(row);return failures-->0?{kind:'retryable',reason:'Timeout'}:{kind:'accepted',messageId:'provider-'+row.to_phone,credits:row.expected_parts}};
  expect(await runSmsWorker(now,{},deps)).toMatchObject({accepted:1,failed:1});
  await db.exec("update admin_sms_outbox set next_attempt_at=now()-interval '1 second' where status='queued'");
  deps.summary=async()=>({reportDate:'2026-09-29',asOf:now.toISOString(),month:'2026-09',yesterdayRevenueCents:1,monthRevenueCents:1,overdueFulfilment:0,lowStockNames:[]});
  await runSmsWorker(now,{},deps);
  expect(sent).toHaveLength(3);
  expect(sent[2].body).toBe(sent[0].body);
  expect(sent[2].idempotency_key).toBe(sent[0].idempotency_key);
});
it('fails closed on unavailable business data or incomplete recipients',async()=>{
  deps.summary=async()=>{throw new Error('Source unavailable')};
  await expect(runSmsWorker(now,{},deps)).rejects.toThrow('Source unavailable');
  expect(sent).toHaveLength(0);
  expect((await db.query('select id from admin_sms_outbox')).rows).toHaveLength(0);
});
it('alerts on low credit and sends a manual test only to the explicitly selected list member',async()=>{
  deps.balance=async()=>20;
  await db.exec('update admin_sms_settings set enabled=false');
  const test={id:'00000000-0000-0000-0000-000000000099',phone:'61400000002'};
  await runSmsWorker(now,{test},deps);
  expect(sent.map(r=>r.to_phone)).toEqual(['61400000002']);
  expect(sent[0].body).toMatch(/^TEST: Daily ECL Director Update:/);
  expect(alerts).toContain('low-credit');
  await runSmsWorker(now,{test},deps);
  expect(sent).toHaveLength(1);
  await expect(runSmsWorker(now,{test:{...test,phone:'61400000003'}},deps)).rejects.toThrow(/current director/);
});
