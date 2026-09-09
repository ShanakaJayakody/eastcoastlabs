'use server';
import {revalidatePath} from 'next/cache';
import {requireAdmin} from '@/lib/admin/auth';
import {emailOperation,type EmailOperation} from '@/lib/admin/email-operations';
export async function operateEmail(id:string,action:EmailOperation,reason:string,providerId?:string):Promise<{ok:boolean;message?:string;error?:string}>{
 const session=await requireAdmin();
 try{
  const status=await emailOperation(id,action,reason,session.email,providerId);
  revalidatePath('/admin/automation');
  return {ok:true,message:status==='sent'?'Provider acceptance reconciled. Delivery events remain in customer history.':status==='queued'?'Eligible retry queued with its original identity.':`Message ${status}.`};
 }catch(error){return {ok:false,error:error instanceof Error?error.message:'Operation could not be confirmed. Refresh and inspect the message.'};}
}
