import { normalizeAustralianMobile, renderAdminSms, smsSchedule, smsSegments } from './format';
import type { AdminSmsSettings, AdminSmsSummary, FrozenSms, SmsOutboxRow, SmsRecipient, SmsSendResult } from './types';

export type SmsIssue='low-credit'|'delivery'|'worker'|'unresolved';
export interface SmsWorkerDependencies {
  enabled():boolean;
  settings():Promise<AdminSmsSettings>;
  summary(now:Date):Promise<AdminSmsSummary>;
  recipients():Promise<SmsRecipient[]>;
  balance():Promise<number>;
  config():{sender:string;fingerprint:string};
  send(row:FrozenSms):Promise<SmsSendResult>;
  rpc(name:string,args:Record<string,unknown>):Promise<unknown>;
  alert(issue:SmsIssue,now:Date):Promise<void>;
}
export interface SmsRunOptions {dry?:boolean;test?:{id:string;phone:string}}

export async function runSmsWorker(now:Date,options:SmsRunOptions,deps:SmsWorkerDependencies):Promise<Record<string,unknown>> {
  if(!options.dry&&!deps.enabled())return {disabled:true};
  const settings=await deps.settings();
  if(!options.dry&&!options.test&&!settings.enabled)return {paused:true};
  const window=smsSchedule(now,settings.start_hour);
  if(!options.dry&&!options.test&&!window.eligible)return {outsideWindow:true};
  const [summary,list,balance]=await Promise.all([deps.summary(now),deps.recipients(),deps.balance()]);
  let recipients=[...new Map(list.map(r=>[r.phone,r])).values()];
  if(!recipients.length)throw new Error('No verified director recipients');
  if(options.test){
    const phone=normalizeAustralianMobile(options.test.phone);
    recipients=recipients.filter(r=>r.phone===phone);
    if(recipients.length!==1)throw new Error('Select a current director list member');
    if(!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(options.test.id))throw new Error('Invalid test identity');
  }
  const body=(options.test?'TEST: ':'')+renderAdminSms(summary);
  const parts=smsSegments(body);
  if(options.dry)return {dry:true,body,parts,balance,recipientCount:recipients.length,recipients,estimatedCredits:parts*recipients.length,summary,settings};
  if(balance<50)await deps.alert('low-credit',now);
  if(balance<parts*recipients.length)throw new Error('Insufficient credits for all director recipients');
  const config=deps.config();
  const queued=await deps.rpc('enqueue_admin_sms',{
    p_day:window.day,p_body:body,p_parts:parts,p_sender:config.sender,p_fingerprint:config.fingerprint,
    p_recipients:recipients,p_expires:options.test?new Date(now.getTime()+3600000).toISOString():window.expiresAt,
    p_summary:summary,p_test_id:options.test?.id??null,
  });
  let accepted=0,failed=0,cancelled=0;
  const deadline=Date.now()+40000;
  for(let i=0;i<8&&Date.now()<deadline;i++){
    if(!deps.enabled())break;
    const claimed=await deps.rpc('claim_admin_sms',{p_day:window.day,p_id:options.test?.id??null}) as SmsOutboxRow[];
    const row=claimed[0];if(!row)break;
    // List removal and pause both take effect on a queued/retried message.
    const current=await deps.recipients();
    const allowed=await deps.rpc('authorize_admin_sms',{p_id:row.id,p_token:row.lease_token,
      p_current_phones:current.map(r=>r.phone),p_fingerprint:deps.config().fingerprint});
    if(!allowed||!deps.enabled()){cancelled++;continue;}
    const result=await deps.send(row);
    const ok=await deps.rpc('finish_admin_sms',{p_id:row.id,p_token:row.lease_token,
      p_outcome:result.kind==='accepted'?'accepted':result.kind==='retryable'?'retry':result.kind==='rejected'?'failed':'uncertain',
      p_message_id:result.kind==='accepted'?result.messageId:null,p_credits:result.kind==='accepted'?result.credits:null,
      p_error:result.kind==='accepted'?null:result.reason});
    if(!ok)throw new Error('SMS delivery outcome could not be recorded');
    if(result.kind==='accepted')accepted++;else failed++;
  }
  if(failed)await deps.alert('delivery',now);
  return {date:window.day,queued,accepted,failed,cancelled,recipients:recipients.length};
}
