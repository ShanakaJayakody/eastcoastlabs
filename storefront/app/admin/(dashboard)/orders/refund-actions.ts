'use server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/auth';
import { quoteRefund,commitReviewedRefund,settleRefund,type RefundSelection } from '@/lib/admin/refunds';
const failure=(error:unknown)=>{
 const message=error instanceof Error?error.message:'Refund operation failed';
 return {ok:false as const,error:message,stale:/REFUND_PREVIEW_(STALE|SELECTION_CHANGED|REQUIRED)/.test(message)};
};
export async function previewRefund(orderId:string,selection:RefundSelection,restock:boolean){
 await requireAdmin();
 try{return {ok:true as const,quote:await quoteRefund(orderId,selection,restock)}}catch(error){return failure(error)}
}
export async function commitRefund(orderId:string,selection:RefundSelection,restock:boolean,token:string,key:string){
 const session=await requireAdmin();
 try{
  const result=await commitReviewedRefund(orderId,selection,restock,token,key,session.email);
  revalidatePath(`/admin/orders/${orderId}`);revalidatePath('/admin/orders');revalidatePath('/admin');
  return {ok:true as const,...result};
 }catch(error){return failure(error)}
}
export async function recordRefundSettlement(orderId:string,cents:number,reference:string,date:string,key:string){
 const session=await requireAdmin();
 try{
  await settleRefund(orderId,cents,reference,date,key,session.email);
  revalidatePath(`/admin/orders/${orderId}`);
  return {ok:true as const};
 }catch(error){return failure(error)}
}
