import {NextResponse} from 'next/server';
import {rejectUnauthorizedCron} from '@/lib/cron-auth';
import {cronHealth} from '@/lib/admin/cron-runs';
import {adminDb} from '@/lib/admin/db';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow'};
/** Read-only external-monitor target. It never runs a sweep or exposes PII. */
export async function GET(request:Request){
 const rejection=rejectUnauthorizedCron(request);
 if(rejection){for(const [name,value] of Object.entries(headers))rejection.headers.set(name,value);return rejection;}
 try{
  const db=adminDb();
  const [jobs,dead,overdue]=await Promise.all([
   cronHealth(),
   db.from('email_outbox').select('id',{head:true,count:'exact'}).eq('status','dead'),
   db.from('email_outbox').select('id',{head:true,count:'exact'}).in('status',['queued','failed','sending'])
    .lt('next_attempt_at',new Date(Date.now()-2*3600_000).toISOString()),
  ]);
  if(dead.error||overdue.error||dead.count===null||overdue.count===null)throw new Error('Health read failed');
  const ok=jobs.every(job=>job.state==='ok')&&dead.count===0&&overdue.count===0;
  return NextResponse.json({ok,checkedAt:new Date().toISOString(),jobs:jobs.map(({job,state,ageHours})=>({job,state,ageHours})),delivery:{dead:dead.count,overdue:overdue.count}}, {status:ok?200:503,headers});
 }catch{return NextResponse.json({ok:false,error:'Operational health unavailable'}, {status:503,headers});}
}
