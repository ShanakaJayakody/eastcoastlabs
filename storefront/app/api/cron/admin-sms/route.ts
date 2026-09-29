import { NextResponse } from 'next/server';
import { rejectUnauthorizedCron } from '@/lib/cron-auth';
import { recordCronRun } from '@/lib/admin/cron-runs';
import { runDailyAdminSms, queueAdminSmsAlert } from '@/lib/admin/daily-sms';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function GET(request:Request) {
  const rejected=rejectUnauthorizedCron(request);if(rejected)return rejected;
  const dry=new URL(request.url).searchParams.get('dry')==='1';
  try {
    if(dry)return NextResponse.json(await runDailyAdminSms(new Date(),{dry:true}));
    return NextResponse.json(await recordCronRun('admin-sms',()=>runDailyAdminSms()));
  } catch {
    if(!dry)await queueAdminSmsAlert('worker').catch(()=>console.error('Director SMS alert could not be queued'));
    return NextResponse.json({error:'Director SMS could not finish; check admin settings and job status'},{status:503});
  }
}
