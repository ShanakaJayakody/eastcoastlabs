import 'server-only';
import { adminDb } from './db';
import { listProducts } from './products';
import { briefRecipients } from './daily-brief';
import { queueEmail } from './email';
import { emailShell, emailButton } from '@/lib/email/layout';
import { smsSchedule, selectLowStockNames, ADMIN_SMS_STOCK_SLUGS } from '@/lib/sms/format';
import { mobileMessageConfig, listAdminSmsRecipients, getMobileMessageBalance, sendMobileMessage } from '@/lib/sms/mobile-message';
import { runSmsWorker, type SmsIssue, type SmsRunOptions } from '@/lib/sms/worker';
import type { AdminSmsSettings, AdminSmsSummary, SmsOutboxRow } from '@/lib/sms/types';

export async function smsRpc(name:string,args:Record<string,unknown>):Promise<unknown> {
  const {data,error}=await adminDb().rpc(name,args);
  if(error)throw new Error(`Director SMS database operation failed: ${name}`);
  return data;
}
export async function getAdminSmsSettings():Promise<AdminSmsSettings> {
  const {data,error}=await adminDb().from('admin_sms_settings').select('enabled,start_hour').eq('singleton',true).single();
  if(error||!data)throw new Error('Director SMS settings unavailable');
  return data as AdminSmsSettings;
}
export async function buildAdminSmsSummary(now=new Date()):Promise<AdminSmsSummary> {
  const [totals,products]=await Promise.all([smsRpc('admin_sms_order_totals',{p_now:now.toISOString()}),listProducts({requireStockFor:ADMIN_SMS_STOCK_SLUGS})]);
  if(!totals||typeof totals!=='object')throw new Error('Director SMS totals unavailable');
  const day=smsSchedule(now,8).day;
  const yesterday=new Date(new Date(day+'T12:00:00Z').getTime()-86400000).toISOString().slice(0,10);
  const values=totals as Pick<AdminSmsSummary,'yesterdayRevenueCents'|'monthRevenueCents'|'overdueFulfilment'>;
  return {...values,reportDate:yesterday,month:day.slice(0,7),asOf:now.toISOString(),lowStockNames:selectLowStockNames(products)};
}
const ISSUE_LABELS:Record<SmsIssue,string>={
  'low-credit':'SMS credits are below 50. Top up the Mobile Message account.',
  delivery:'One or more director messages were rejected or need a retry. Check the delivery history.',
  worker:'The daily director SMS job could not finish. Check the job status and configuration.',
  unresolved:'A director message is failed, expired or still awaiting a delivery report. Check Mobile Message before resending.',
};
export async function queueAdminSmsAlert(issue:SmsIssue,now=new Date()):Promise<void> {
  const day=smsSchedule(now,8).day;
  const subject='ECL director SMS needs attention';
  const html=emailShell({audience:'admin',preheader:subject,body:`<h1>${subject}</h1><p>${ISSUE_LABELS[issue]}</p>${emailButton('https://www.eastcoastlabs.com.au/admin/settings','View SMS settings')}`});
  for(const to of await briefRecipients())await queueEmail({to,template:'admin_daily_brief',payload:{subject,html},relatedType:'admin_sms_alert',relatedId:`admin-sms:${day}:${issue}`});
}
export async function recentAdminSms():Promise<SmsOutboxRow[]> {
  const {data,error}=await adminDb().from('admin_sms_outbox')
    .select('id,kind,local_send_date,to_phone,body,expected_parts,status,created_at,last_error')
    .order('created_at',{ascending:false}).limit(20);
  if(error)throw new Error('Director SMS delivery history unavailable');
  return data as SmsOutboxRow[];
}
async function alertUnresolved(now:Date) {
  const count=await smsRpc('admin_sms_unresolved_count',{});
  if(count)await queueAdminSmsAlert('unresolved',now);
}
export async function runDailyAdminSms(now=new Date(),options:SmsRunOptions={}):Promise<Record<string,unknown>> {
  const enabled=()=>process.env.ADMIN_SMS_ENABLED==='true';
  if(!options.dry&&enabled()){
    await smsRpc('reconcile_admin_sms',{});
    await alertUnresolved(now);
  }
  return runSmsWorker(now,options,{
    enabled,settings:getAdminSmsSettings,summary:buildAdminSmsSummary,recipients:listAdminSmsRecipients,
    balance:getMobileMessageBalance,config:mobileMessageConfig,send:sendMobileMessage,rpc:smsRpc,alert:queueAdminSmsAlert,
  });
}
