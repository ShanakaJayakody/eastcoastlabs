/** Verify private responses from an owned loopback production server, without app credentials. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {existsSync} from 'node:fs';
import {createServer} from 'node:net';
import {resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';

assert(existsSync(resolve(process.env.NEXT_DIST_DIR || '.next','BUILD_ID')),'Run the production build before checking response headers');
const allocation=createServer();
allocation.listen(0,'127.0.0.1');await once(allocation,'listening');
const port=allocation.address().port;
await new Promise((done,reject)=>allocation.close(error=>error?reject(error):done()));
const env={...process.env,NEXT_TELEMETRY_DISABLED:'1'};
// Explicit empty values also prevent Next's dotenv loader from filling these.
for(const name of ['SUPABASE_DB_URL','SUPABASE_SERVICE_ROLE_KEY','NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','RESEND_API_KEY','RESEND_WEBHOOK_SECRET','GA4_API_SECRET','NEXT_PUBLIC_GA4_ID','ORDER_ACCESS_SECRET','UNSUBSCRIBE_SECRET','CRON_SECRET'])env[name]='';
delete env.NO_COLOR;delete env.FORCE_COLOR;
const child=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port',String(port)],{env,stdio:['ignore','pipe','pipe']});
let exited=false,spawnError;
child.once('error',error=>{spawnError=error;});
const closed=once(child,'close').then(()=>{exited=true;}).catch(error=>{spawnError=error;exited=true;});
// Drain output without copying response bodies or diagnostic payloads into logs.
child.stdout.resume();child.stderr.resume();
const base=`http://127.0.0.1:${port}`;
try{
 let ready=false;
 for(let attempt=0;attempt<100;attempt++){
  if(spawnError)throw spawnError;
  assert(!exited,'Owned production server exited before header verification');
  try{const response=await fetch(`${base}/cart-recovery`,{redirect:'manual',signal:AbortSignal.timeout(1000)});await response.body?.cancel();ready=true;break;}catch{await delay(100);}
 }
 assert(ready,'Owned production server did not become ready');
 const routes=['/cart-recovery','/cart-recovery?token=synthetic-invalid','/checkout','/checkout/thank-you','/pay/synthetic-invalid','/leave-a-review','/subscribe/confirm','/api/unsubscribe'];
 for(const route of [...routes,'/api/operations/health']){
  assert(!exited,'Owned production server stopped during header verification');
  const response=await fetch(`${base}${route}`,{redirect:'manual',signal:AbortSignal.timeout(10000)});
  await response.body?.cancel();
  const expectedStatus=route==='/api/operations/health'?503:route==='/pay/synthetic-invalid'?404:200;
  assert.equal(response.status,expectedStatus,`${route}: unexpected HTTP status`);
  const cache=response.headers.get('cache-control')||'',robots=response.headers.get('x-robots-tag')||'';
  assert(cache.includes('private')&&cache.includes('no-store'),`${route}: missing private/no-store Cache-Control`);
  assert(robots.includes('noindex')&&robots.includes('nofollow'),`${route}: missing noindex/nofollow X-Robots-Tag`);
  if(route!=='/api/operations/health')assert.equal(response.headers.get('referrer-policy'),'no-referrer',`${route}: missing no-referrer policy`);
  console.log(`PASS ${route}: HTTP ${response.status}, private response headers`);
 }
 console.log('9 private response checks passed; owned loopback production server only');
}finally{
 if(!exited){child.kill('SIGTERM');await Promise.race([closed,delay(5000,undefined,{ref:false})]);if(!exited){child.kill('SIGKILL');await closed;}}
}
