'use server';
import {revalidatePath} from 'next/cache';
import {requireAdmin} from '@/lib/admin/auth';
import {registerStockLot,allocateOrderLots,previewCarrierCsv,commitCarrierRows} from '@/lib/admin/fulfilment';
const failure=(e:unknown)=>({ok:false as const,error:e instanceof Error?e.message:'Fulfilment operation failed'});
export async function registerLot(input:Parameters<typeof registerStockLot>[0]){
 const admin=await requireAdmin();
 try{await registerStockLot(input,admin.email);revalidatePath('/admin/orders','layout');return {ok:true as const}}catch(e){return failure(e)}
}
export async function saveLotAssignments(orderId:string,itemId:string,poolId:string,assignments:{lotId:string;units:number}[],evidence:string){
 const admin=await requireAdmin();
 try{await allocateOrderLots(orderId,itemId,poolId,assignments,evidence,admin.email);revalidatePath('/admin/orders','layout');return {ok:true as const}}catch(e){return failure(e)}
}
export async function previewCarrier(csv:string){
 await requireAdmin();try{return {ok:true as const,rows:await previewCarrierCsv(csv)}}catch(e){return failure(e)}
}
export async function commitCarrier(tokens:string[],notify:boolean){
 const admin=await requireAdmin();
 try{const rows=await commitCarrierRows(tokens,notify,admin.email);revalidatePath('/admin/orders','layout');return {ok:true as const,rows}}catch(e){return failure(e)}
}
