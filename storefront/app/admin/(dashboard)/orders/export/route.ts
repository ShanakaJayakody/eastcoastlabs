import {requireAdmin} from '@/lib/admin/auth';
import {workspaceOrdersCsv,OrderExportTooLargeError} from '@/lib/admin/order-workspace/export';
import {parseOrderWorkspaceParams,rawOrderParams} from '@/lib/admin/order-workspace/params';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 await requireAdmin();
 const params=parseOrderWorkspaceParams(rawOrderParams(new URL(request.url).searchParams));
 const headers={'Cache-Control':'private, no-store'};
 try{
  const csv=await workspaceOrdersCsv(params);
  return new Response(csv,{headers:{...headers,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="ecl-orders-${new Date().toISOString().slice(0,10)}.csv"`}});
 }catch(error){return Response.json({error:error instanceof OrderExportTooLargeError?error.message:'Unable to export orders. Try again.'},{status:error instanceof OrderExportTooLargeError?400:500,headers});}
}
