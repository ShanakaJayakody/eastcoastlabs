import 'server-only';
import {getOrder} from '@/lib/admin/order-queries';
import {getOrderFulfilment} from '@/lib/admin/fulfilment';
import {getOrderWorkspaceRow} from './queries';
import type {OrderPreview} from './types';
export class OrderPreviewConflict extends Error {constructor(){super('This order changed. Reload its details.');}}
export async function getOrderPreview(id:string):Promise<OrderPreview|null>{
 for(let attempt=0;attempt<2;attempt++){
  const [detail,factResult,fulfilmentResult]=await Promise.allSettled([getOrder(id),getOrderWorkspaceRow(id),getOrderFulfilment(id)]);
  if(detail.status==='fulfilled'&&detail.value===null&&factResult.status==='fulfilled'&&factResult.value===null)return null;
  if(detail.status==='rejected')throw detail.reason;
  if(factResult.status==='rejected')throw factResult.reason;
  if(fulfilmentResult.status==='rejected')throw fulfilmentResult.reason;
  const order=detail.value,facts=factResult.value,fulfilment=fulfilmentResult.value;
  if(order&&facts&&order.id===id&&facts.id===id&&fulfilment.orderId===id&&order.status===facts.status&&fulfilment.status===facts.status&&order.refunded_cents===facts.refunded_cents&&order.total_cents===facts.total_cents)return {order,facts,fulfilment};
 }
 throw new OrderPreviewConflict();
}
