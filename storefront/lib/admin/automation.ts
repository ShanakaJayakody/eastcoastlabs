import 'server-only';
import {adminDb} from './db';
export const OUTBOX_STATES=['queued','sending','failed','dead','cancelled','sent'] as const;
export type OutboxState=typeof OUTBOX_STATES[number];
export interface AutomationMessage{id:string;to_email:string;template:string;status:OutboxState;error:string|null;created_at:string;attempt_count:number;next_attempt_at:string|null;lease_expires_at:string|null;}
/** Read-only operator view. Dead messages require provider reconciliation; this
 * surface deliberately never changes an idempotency key or requeues a send. */
export async function automationOverview(status:string,page=1):Promise<{summary:{status:OutboxState;count:number;oldestAt:string|null}[];rows:AutomationMessage[];total:number}>{
 const db=adminDb();
 const summary=await Promise.all(OUTBOX_STATES.map(async state=>{
  const {data,count,error}=await db.from('email_outbox').select('created_at',{count:'exact'}).eq('status',state).order('created_at').limit(1);
  if(error)throw new Error(error.message);
  return {status:state,count:count??0,oldestAt:data?.[0]?.created_at??null};
 }));
 let q=db.from('email_outbox').select('id,to_email,template,status,error,created_at,attempt_count,next_attempt_at,lease_expires_at',{count:'exact'});
 if(OUTBOX_STATES.includes(status as OutboxState))q=q.eq('status',status);else q=q.in('status',['queued','sending','failed','dead']);
 const {data,count,error}=await q.order('created_at').order('id').range((page-1)*50,page*50-1);
 if(error)throw new Error(error.message);
 return {summary,rows:(data??[]) as AutomationMessage[],total:count??0};
}
