import {requireAdmin} from '@/lib/admin/auth';
import {isOrderId} from '@/lib/admin/order-workspace/params';
import {getOrderPreview,OrderPreviewConflict} from '@/lib/admin/order-workspace/preview';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 await requireAdmin();
 const {id}=await params;if(!isOrderId(id))return Response.json({error:'Invalid order ID.'},{status:400,headers});
 try{const preview=await getOrderPreview(id);return preview?Response.json(preview,{headers}):Response.json({error:'Order no longer available'},{status:404,headers});}
 catch(error){return Response.json({error:error instanceof OrderPreviewConflict?error.message:'Unable to load order. Try again.'},{status:error instanceof OrderPreviewConflict?409:500,headers});}
}
