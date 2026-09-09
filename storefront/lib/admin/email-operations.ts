import 'server-only';
import {Resend} from 'resend';
import {adminDb} from './db';
export type EmailOperation='cancel'|'retry'|'reconcile';
interface FrozenMessage {
 id:string;to_email:string;rendered_tag:string|null;rendered_from:string|null;rendered_subject:string|null;rendered_html:string|null;
 provider_attempted_at:string|null;provider_message_id:string|null;status:string;lease_token:string|null;lease_expires_at:string|null;
}
/** Reconciliation records provider acceptance. It never sends or changes the
 * outbox's stable provider key, and does not claim successful mailbox delivery. */
export async function emailOperation(id:string,action:EmailOperation,reason:string,actor:string,providerId?:string):Promise<string>{
 if(!['cancel','retry','reconcile'].includes(action)||!reason.trim()||reason.length>1000)throw new Error('Choose an action and provide a reason (maximum 1,000 characters).');
 const db=adminDb();
 if(action!=='reconcile'){
  const {data,error}=await db.rpc('admin_email_operation',{p_id:id,p_action:action,p_actor:actor,p_reason:reason.trim(),p_provider_id:null});
  if(error)throw new Error(error.message);return String(data);
 }
 if(!providerId?.trim()||providerId.length>200)throw new Error('Enter the exact provider message ID.');
 const {data:raw,error:readError}=await db.from('email_outbox').select('id,to_email,rendered_tag,rendered_from,rendered_subject,rendered_html,provider_attempted_at,provider_message_id,status,lease_token,lease_expires_at').eq('id',id).single();
 if(readError||!raw)throw new Error('Cannot read queued message.');
 const row=raw as FrozenMessage;providerId=providerId.trim();
 if(row.status==='sending'&&(!row.lease_expires_at||Date.parse(row.lease_expires_at)>Date.now()))throw new Error('Active delivery lease; wait for the worker outcome.');
 if(row.provider_message_id){
  const {data,error}=await db.rpc('admin_email_operation',{p_id:id,p_action:action,p_actor:actor,p_reason:reason.trim(),p_provider_id:providerId});
  if(error)throw new Error(error.message);return String(data);
 }
 if(row.rendered_tag!==row.id||!row.rendered_from||!row.rendered_subject||!row.rendered_html||!row.provider_attempted_at)throw new Error('Complete frozen message proof is unavailable; leave this message unresolved.');
 const key=process.env.RESEND_API_KEY;if(!key)throw new Error('Provider retrieval is not configured; message remains unresolved.');
 let response;
 try{response=await new Resend(key).emails.get(providerId);}catch{throw new Error('Provider retrieval unavailable; message remains unresolved');}
 if(response.error||!response.data)throw new Error('Provider retrieval unavailable; message remains unresolved');
 const found=response.data;
 if(found.tags?.filter(tag=>tag.name==='ecl_outbox_id').length!==1||!found.tags.some(tag=>tag.name==='ecl_outbox_id'&&tag.value===row.rendered_tag)||found.id!==providerId||found.to.length!==1||found.to[0]!==row.to_email||found.from!==row.rendered_from||found.subject!==row.rendered_subject||found.html!==row.rendered_html||
  found.cc?.length||found.bcc?.length||!['sent','delivered','delivery_delayed','bounced','complained','opened','clicked'].includes(found.last_event)||
  !Number.isFinite(Date.parse(found.created_at))||Date.parse(found.created_at)<Date.parse(row.provider_attempted_at)-300_000){
  throw new Error('Provider proof does not match the original frozen message; leave it unresolved.');
 }
 const {data,error}=await db.rpc('admin_reconcile_email',{p_id:id,p_provider_id:providerId,p_actor:actor,p_reason:reason.trim(),
  p_snapshot:{to:row.to_email,from:row.rendered_from,subject:row.rendered_subject,html:row.rendered_html,tag:row.rendered_tag,provider_attempted_at:row.provider_attempted_at,status:row.status,lease_token:row.lease_token}});
 if(error)throw new Error(error.message);return String(data);
}
