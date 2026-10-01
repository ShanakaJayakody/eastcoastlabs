'use server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/auth';
import { assertPreviewWritable } from '@/lib/admin/preview-policy';
import { smsRpc, runDailyAdminSms } from '@/lib/admin/daily-sms';

export async function saveAdminSmsSettings(input:{enabled:boolean;startHour:number}) {
  const session=await requireAdmin(); assertPreviewWritable();
  if(typeof input.enabled!=='boolean'||!Number.isInteger(input.startHour)||input.startHour<0||input.startHour>19)
    return {ok:false,error:'Choose a valid daily delivery hour between midnight and 7 pm.'};
  try {
    await smsRpc('save_admin_sms_settings',{p_enabled:input.enabled,p_start_hour:input.startHour,p_actor:session.email});
    revalidatePath('/admin/settings');return {ok:true};
  } catch {return {ok:false,error:'SMS settings could not be saved.'}}
}
export async function previewAdminSms() {
  await requireAdmin(); assertPreviewWritable();
  try {return {ok:true,preview:await runDailyAdminSms(new Date(),{dry:true})}}
  catch {return {ok:false,error:'Preview unavailable. Check the SMS configuration, director list and business data.'}}
}
export async function testAdminSms(phone:string,id:string) {
  await requireAdmin(); assertPreviewWritable();
  try {
    const result=await runDailyAdminSms(new Date(),{test:{phone,id}});
    revalidatePath('/admin/settings');
    if(result.disabled)return {ok:false,error:'Sending has not been activated on the server.'};
    if(result.accepted===1)return {ok:true,message:'Test accepted by Mobile Message. Delivery will appear in the history.'};
    return {ok:false,error:'No new test was accepted. Check the delivery history before retrying.'};
  } catch {return {ok:false,error:'The test could not finish. Check the delivery history before retrying.'}}
}
