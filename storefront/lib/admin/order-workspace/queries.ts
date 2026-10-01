import 'server-only';
import {adminDb} from '@/lib/admin/db';
import {sydneyDayBoundary} from '@/lib/admin/order-queries';
import {isOrderId,ORDER_VIEWS} from './params';
import {ISSUE_LABELS} from './presentation';
import type {OrderIssue,OrderWorkspaceParams,OrderWorkspacePage,OrderWorkspaceRow} from './types';

export class OrderExportTooLargeError extends Error {
 constructor(){super('More than 20,000 orders match. Narrow the date range or filters.');this.name='OrderExportTooLargeError';}
}
function invalid(field:string):never {throw new Error(`Invalid orders workspace response: ${field}`);}
function object(value:unknown,field:string):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))return invalid(field);return value as Record<string,unknown>;}
function string(value:unknown,field:string):string{if(typeof value!=='string')return invalid(field);return value;}
function nullableString(value:unknown,field:string){return value===null?null:string(value,field);}
function integer(value:unknown,field:string):number{if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0)return invalid(field);return value;}
function nullableInteger(value:unknown,field:string){return value===null?null:integer(value,field);}
function timestamp(value:unknown,field:string):string{const s=string(value,field);if(!/^\d{4}-\d{2}-\d{2}T/.test(s)||!Number.isFinite(Date.parse(s)))return invalid(field);return s;}
function id(value:unknown):string{if(!isOrderId(value))return invalid('id');return value;}
export function decodeWorkspaceRow(value:unknown):OrderWorkspaceRow {
 const r=object(value,'row');
 if(!['pending','paid','processing','shipped','completed','refunded','cancelled'].includes(String(r.status)))return invalid('status');
 if(r.shipping_method!=='standard'&&r.shipping_method!=='express')return invalid('shipping_method');
 if(typeof r.has_notes!=='boolean')return invalid('has_notes');
 if(!Array.isArray(r.issue_keys)||!r.issue_keys.every(k=>typeof k==='string'&&Object.hasOwn(ISSUE_LABELS,k)))return invalid('issue_keys');
 if(!Array.isArray(r.items)||r.items.length>3)return invalid('items');
 if(r.waiting_seconds!==null&&(typeof r.waiting_seconds!=='number'||!Number.isFinite(r.waiting_seconds)||r.waiting_seconds<0||r.waiting_seconds>Number.MAX_SAFE_INTEGER))return invalid('waiting_seconds');
 return {
  id:id(r.id),order_number:string(r.order_number,'order_number'),status:r.status as OrderWorkspaceRow['status'],
  customer_name:nullableString(r.customer_name,'customer_name'),customer_email:string(r.customer_email,'customer_email'),
  total_cents:integer(r.total_cents,'total_cents'),refunded_cents:integer(r.refunded_cents,'refunded_cents'),refund_settled_cents:integer(r.refund_settled_cents,'refund_settled_cents'),
  created_at:r.created_at===null?null:timestamp(r.created_at,'created_at'),paid_at:r.paid_at===null?null:timestamp(r.paid_at,'paid_at'),shipped_at:r.shipped_at===null?null:timestamp(r.shipped_at,'shipped_at'),
  payment_method:nullableString(r.payment_method,'payment_method'),payment_ref:nullableString(r.payment_ref,'payment_ref'),tracking_number:nullableString(r.tracking_number,'tracking_number'),
  shipping_method:r.shipping_method,destination:nullableString(r.destination,'destination'),line_count:integer(r.line_count,'line_count'),
  items:r.items.map(value=>{const i=object(value,'item');const qty=integer(i.qty,'qty'),refunded_qty=integer(i.refunded_qty,'refunded_qty');if(refunded_qty>qty)return invalid('refunded_qty');return {id:id(i.id),product_name:nullableString(i.product_name,'product_name'),variant_label:nullableString(i.variant_label,'variant_label'),size_label:nullableString(i.size_label,'size_label'),sku:nullableString(i.sku,'sku'),qty,refunded_qty};}),
  ordered_physical_units:nullableInteger(r.ordered_physical_units,'ordered_physical_units'),remaining_physical_units:nullableInteger(r.remaining_physical_units,'remaining_physical_units'),
  waiting_seconds:r.waiting_seconds as number|null,issue_keys:r.issue_keys as OrderIssue[],has_notes:r.has_notes,
 };
}
function filters(p:OrderWorkspaceParams){return {status:p.status,q:p.q,from_at:sydneyDayBoundary(p.from),to_at:sydneyDayBoundary(p.to,true),discount:p.discount,shipping:p.shipping,sort:p.sort,dir:p.dir,page:p.page};}
async function read(name:string,args:Record<string,unknown>){const {data,error}=await adminDb().rpc(name,args);if(error){if(error.message.includes('ORDER_EXPORT_TOO_LARGE'))throw new OrderExportTooLargeError();throw new Error(`${name}: ${error.message}`);}return data as unknown;}
function envelope(value:unknown,max:number){const e=object(value,'envelope');if(!Array.isArray(e.rows)||e.rows.length>max)return invalid('rows');const rows=e.rows.map(decodeWorkspaceRow),total=integer(e.total,'total');if(total<rows.length||new Set(rows.map(r=>r.id)).size!==rows.length)return invalid('total / duplicate IDs');return {e,rows,total,as_of:timestamp(e.as_of,'as_of')};}
export async function getOrderWorkspace(p:OrderWorkspaceParams):Promise<OrderWorkspacePage>{
 const {e,...result}=envelope(await read('admin_order_workspace',{p_filters:filters(p)}),25);
 const counts=object(e.counts,'counts');for(const key of ORDER_VIEWS)integer(counts[key],`counts.${key}`);
 const page=integer(e.page,'page');if(page<1||e.page_size!==25||page>Math.max(1,Math.ceil(result.total/25)))return invalid('page');
 return {...result,page,page_size:25,counts:counts as OrderWorkspacePage['counts']};
}
export async function getOrderWorkspaceRow(orderId:string):Promise<OrderWorkspaceRow|null>{
 id(orderId);const result=await read('admin_order_workspace_scope',{p_filters:{},p_order_ids:[orderId],p_as_of:new Date().toISOString()});
 if(!Array.isArray(result)||result.length>1)return invalid('individual order');if(!result.length)return null;
 const row=decodeWorkspaceRow(object(result[0],'scope row').facts);if(row.id!==orderId)return invalid('individual ID');return row;
}
export async function getOrderWorkspaceExport(p:OrderWorkspaceParams){const {rows,total,as_of}=envelope(await read('admin_order_workspace_export',{p_filters:filters(p)}),20000);if(total!==rows.length)return invalid('incomplete export');return {rows,total,as_of};}
