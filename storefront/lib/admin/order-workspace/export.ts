import 'server-only';
import {csvRow} from '@/lib/csv';
import {getOrderWorkspaceExport} from './queries';
import {paymentLabel,fulfilmentLabel} from './presentation';
import type {OrderWorkspaceParams} from './types';
export {OrderExportTooLargeError} from './queries';
export async function workspaceOrdersCsv(params:OrderWorkspaceParams):Promise<string>{
 const {rows,as_of}=await getOrderWorkspaceExport(params);
 const headers=['order_number','status','customer_name','customer_email','items','total_aud','placed_at','shipping_method','payment_state','fulfilment_state','ordered_physical_units','remaining_physical_units','paid_at','shipped_at','waiting_seconds','issue_keys','as_of'];
 return [csvRow(headers),...rows.map(r=>csvRow([r.order_number,r.status,r.customer_name,r.customer_email,r.line_count,(r.total_cents/100).toFixed(2),r.created_at,r.shipping_method,paymentLabel(r).label,fulfilmentLabel(r).label,r.ordered_physical_units,r.remaining_physical_units,r.paid_at,r.shipped_at,r.waiting_seconds,r.issue_keys.join('|'),as_of]))].join('\n');
}
