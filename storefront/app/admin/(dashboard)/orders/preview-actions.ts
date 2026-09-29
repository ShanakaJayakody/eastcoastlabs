"use server";
import {requireAdmin} from '@/lib/admin/auth';
import {getOrder} from '@/lib/admin/order-queries';
export async function loadOrderPreview(id:string){
 await requireAdmin();
 if(typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw new Error('Invalid order id.');
 return getOrder(id);
}
