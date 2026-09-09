import { PGlite } from '@electric-sql/pglite';
import { createHash } from 'node:crypto';
import { beforeAll, beforeEach, afterAll, expect, it } from 'vitest';
import { runMigrations, validateMigrations, readMigrations, databaseOptions, parseArguments } from '../supabase/migration-runner.mjs';
let db:PGlite;
const migration=(filename:string,sql:string)=>({filename,sql,sha256:createHash('sha256').update(sql).digest('hex')});
const initial=migration('20260101000000_initial.sql',"create table public.products(name text);insert into public.products values('Seed');");
const update=migration('20260102000000_update.sql',"update public.products set name='Second seed';");
const adapter={query:(sql:string,params?:unknown[])=>db.query<Record<string,unknown>>(sql,params),exec:(sql:string)=>db.exec(sql)};
beforeAll(async()=>{db=new PGlite()});
beforeEach(async()=>{await db.exec('drop schema if exists ecl_migrations cascade;drop schema public cascade;create schema public;')});
afterAll(async()=>{await db.close()});
it('applies once and reapply preserves subsequent admin edits',async()=>{
 const first=await runMigrations(adapter,[initial,update]);expect(first.applied).toEqual([initial.filename,update.filename]);
 await db.query("update public.products set name='Admin edit'");
 expect((await runMigrations(adapter,[initial,update])).applied).toEqual([]);
 expect((await db.query('select name from public.products')).rows[0]).toEqual({name:'Admin edit'});
 expect((await db.query('select count(*)::int n from ecl_migrations.schema_migrations')).rows[0]).toEqual({n:2});
});
it('refuses a changed checksum or missing applied file before new SQL',async()=>{
 await runMigrations(adapter,[initial]);
 await expect(runMigrations(adapter,[migration(initial.filename,initial.sql+' -- changed'),update])).rejects.toThrow(/checksum/i);
 await expect(runMigrations(adapter,[update])).rejects.toThrow(/missing/i);
 expect((await db.query('select name from public.products')).rows[0]).toEqual({name:'Seed'});
});
it('refuses an untracked existing database and baselines exact files without replaying their SQL',async()=>{
 await db.exec("create table public.products(name text);insert into public.products values('Existing admin content')");
 await expect(runMigrations(adapter,[initial,update])).rejects.toThrow(/untracked|baseline/i);
 await expect(runMigrations(adapter,[initial,update],{baselineThrough:'20260101000000'})).rejects.toThrow(/exact|exist|filename/i);
 const result=await runMigrations(adapter,[initial,update],{baselineThrough:initial.filename});
 expect(result.baselined).toEqual([initial.filename]);expect(result.applied).toEqual([]);
 expect((await db.query('select name from public.products')).rows[0]).toEqual({name:'Existing admin content'});
 expect((await runMigrations(adapter,[initial,update])).applied).toEqual([update.filename]);
});
it('dry-run is read-only on fresh and baselined databases',async()=>{
 const first=await runMigrations(adapter,[initial],{dryRun:true});expect(first.pending).toEqual([initial.filename]);
 expect((await db.query("select to_regclass('ecl_migrations.schema_migrations') ledger")).rows[0]).toEqual({ledger:null});
 await db.exec("create table public.products(name text);insert into public.products values('Existing')");
 await runMigrations(adapter,[initial],{baselineThrough:initial.filename,dryRun:true});
 expect((await db.query("select to_regclass('ecl_migrations.schema_migrations') ledger")).rows[0]).toEqual({ledger:null});
 await runMigrations(adapter,[initial],{baselineThrough:initial.filename});
 await runMigrations(adapter,[initial,update],{dryRun:true});
 expect((await db.query('select name from public.products')).rows[0]).toEqual({name:'Existing'});
 expect((await db.query('select count(*)::int n from ecl_migrations.schema_migrations')).rows[0]).toEqual({n:1});
});
it('rolls back a failed file and its ledger entry while preserving prior migrations',async()=>{
 const bad=migration('20260103000000_broken.sql','create table public.should_rollback(id int);select * from public.missing_table;');
 await expect(runMigrations(adapter,[initial,bad])).rejects.toThrow(/missing_table/);
 expect((await db.query("select to_regclass('public.should_rollback') name")).rows[0]).toEqual({name:null});
 expect((await db.query('select filename from ecl_migrations.schema_migrations')).rows).toEqual([{filename:initial.filename}]);
 expect((await runMigrations(adapter,[initial,update])).applied).toEqual([update.filename]);
});
it('baseline ledger writes are all-or-nothing',async()=>{
 await runMigrations(adapter,[initial]);
 await db.exec(`create function ecl_migrations.fail_baseline() returns trigger language plpgsql as $$ begin if new.filename='20260103000000_last.sql' then raise exception 'injected ledger failure';end if;return new;end $$;
 create trigger fail_baseline before insert on ecl_migrations.schema_migrations for each row execute function ecl_migrations.fail_baseline();`);
 const last=migration('20260103000000_last.sql','select 1;');
 await expect(runMigrations(adapter,[initial,update,last],{baselineThrough:last.filename})).rejects.toThrow('injected ledger failure');
 expect((await db.query('select filename from ecl_migrations.schema_migrations')).rows).toEqual([{filename:initial.filename}]);
});
it('rejects backdated new files and baselining an empty database',async()=>{
 await expect(runMigrations(adapter,[initial],{baselineThrough:initial.filename})).rejects.toThrow(/empty|pristine/i);
 await runMigrations(adapter,[initial,update]);
 const old=migration('20251201000000_backdated.sql','select 1;');
 await expect(runMigrations(adapter,[old,initial,update])).rejects.toThrow(/order|backdat/i);
});
it('allows only the exact historical duplicate pair and validates future identities',()=>{
 const old=['20260805100000_coming_soon.sql','20260805100000_lifecycle_marketing.sql'].map(name=>migration(name,'select 1;'));
 expect(()=>validateMigrations(old)).not.toThrow();
 expect(()=>validateMigrations([...old,migration('20260805100000_surprise.sql','select 1;')])).toThrow(/duplicate/i);
 expect(()=>validateMigrations([migration('20260910000000_one.sql','select 1;'),migration('20260910000000_two.sql','select 1;')])).toThrow(/duplicate/i);
 expect(()=>validateMigrations([migration('../escape.sql','select 1;')])).toThrow(/filename/i);
});
it('validates TLS by default and permits explicitly disabled TLS only on loopback',()=>{
 const secure=databaseOptions('postgres://user:secret@example.test/db',{});expect(secure.ssl).toEqual({rejectUnauthorized:true});
 expect(()=>databaseOptions('postgres://user:secret@example.test/db',{SUPABASE_DB_SSL:'disable'})).toThrow(/loopback|local/i);
 expect(databaseOptions('postgres://user:secret@127.0.0.1/db',{SUPABASE_DB_SSL:'disable'}).ssl).toBe(false);
 expect(()=>databaseOptions('postgres://user:secret@example.test/db?sslmode=disable',{})).toThrow(/ssl|TLS/i);
 expect(()=>databaseOptions('postgres://user:secret@example.test/db',{NODE_TLS_REJECT_UNAUTHORIZED:'0'})).toThrow(/TLS/i);
});
it('rejects ambiguous CLI arguments instead of silently selecting a different mode',()=>{
 expect(parseArguments(['--dry-run','--baseline-through',initial.filename])).toEqual({dryRun:true,baselineThrough:initial.filename});
 expect(()=>parseArguments(['--seed'])).toThrow(/unknown|seed/i);
 expect(()=>parseArguments(['--baseline-through'])).toThrow(/filename|requires/i);
});

it('validates every checked-in migration without reading a seed file',async()=>{
 const files=await readMigrations('supabase/migrations');expect(files.length).toBeGreaterThan(20);
 expect(files.every(file=>file.filename!=='seed.sql')).toBe(true);
});
it('rejects top-level transaction control without mistaking function bodies or strings for commands',()=>{
 expect(()=>validateMigrations([migration('20260104000000_bad.sql',"create table public.broken(id int); COMMIT; select 1;")])).toThrow(/transaction control/i);
 expect(()=>validateMigrations([migration('20260104000000_valid.sql',"-- COMMIT;\ncreate function public.test() returns void language plpgsql as $$ begin perform 'COMMIT;';end $$;")])).not.toThrow();
});
it('does not allow URL query host overrides to defeat local-only TLS disable',()=>{
 expect(()=>databaseOptions('postgres://user:secret@localhost/db?host=remote.example.test',{SUPABASE_DB_SSL:'disable'})).toThrow(/host|connection/i);
});

it('rolls back successfully executed SQL when its checksum ledger insert fails',async()=>{
 await runMigrations(adapter,[initial]);
 await db.exec(`create function ecl_migrations.reject_checksum() returns trigger language plpgsql as $$ begin raise exception 'checksum insert rejected';end $$;
 create trigger reject_checksum before insert on ecl_migrations.schema_migrations for each row execute function ecl_migrations.reject_checksum();`);
 await expect(runMigrations(adapter,[initial,update])).rejects.toThrow('checksum insert rejected');
 expect((await db.query('select name from public.products')).rows[0]).toEqual({name:'Seed'});
 expect((await db.query('select filename from ecl_migrations.schema_migrations')).rows).toEqual([{filename:initial.filename}]);
});
it('fails before creating a ledger when another runner owns the advisory lock',async()=>{
 const busy={query:async()=>({rows:[{acquired:false}]}),exec:async()=>{throw new Error('Unexpected write while locked')}};
 await expect(runMigrations(busy,[initial])).rejects.toThrow(/advisory lock/);
 expect((await db.query("select to_regclass('ecl_migrations.schema_migrations') ledger")).rows[0]).toEqual({ledger:null});
});
