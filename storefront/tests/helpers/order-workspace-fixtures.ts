import type {OrderWorkspaceParams,OrderWorkspaceRow,OrderWorkspacePage} from '@/lib/admin/order-workspace/types';
import {parseOrderWorkspaceParams,ORDER_VIEWS} from '@/lib/admin/order-workspace/params';
export function makeWorkspaceParams(patch:Partial<OrderWorkspaceParams>={}):OrderWorkspaceParams{return {...parseOrderWorkspaceParams({}),...patch};}
export function makeWorkspaceRow(patch:Partial<OrderWorkspaceRow>={}):OrderWorkspaceRow{return {
 id:'10000000-0000-4000-8000-000000000001',order_number:'ECL-1048',status:'paid',customer_name:'Alex Sample',customer_email:'alex@example.test',total_cents:14000,refunded_cents:0,refund_settled_cents:0,created_at:'2026-09-29T00:00:00Z',paid_at:'2026-09-29T01:00:00Z',shipped_at:null,payment_method:'Bank transfer',payment_ref:'PAY-1048',tracking_number:null,shipping_method:'express',destination:'Melbourne VIC',line_count:1,
 items:[{id:'20000000-0000-4000-8000-000000000001',product_name:'Sample product',variant_label:'3-pack · 10 mg',size_label:'10 mg',sku:'SAMPLE-3',qty:2,refunded_qty:0}],ordered_physical_units:6,remaining_physical_units:6,waiting_seconds:3600,issue_keys:[],has_notes:false,...patch};}
export function makeWorkspacePage(rows:OrderWorkspaceRow[]=[makeWorkspaceRow()]):OrderWorkspacePage{
 return {rows,total:rows.length,counts:Object.fromEntries(ORDER_VIEWS.map(v=>[v,v==='all'?rows.length:rows.filter(r=>v==='to_fulfil'?['paid','processing'].includes(r.status):v==='needs_attention'?r.issue_keys.length:r.status===v).length])) as OrderWorkspacePage['counts'],as_of:'2026-09-29T02:00:00Z',page:1,page_size:25};
}
