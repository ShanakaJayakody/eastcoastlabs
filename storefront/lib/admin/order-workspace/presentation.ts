import {formatAud} from '@/lib/format';
import type {OrderColumn,OrderIssue,OrderLabel,OrderView,OrderWorkspaceRow} from './types';
export const VIEW_LABELS:Record<OrderView,string>={to_fulfil:'To fulfil',pending:'Awaiting payment',needs_attention:'Needs attention',shipped:'Shipped',all:'All orders',paid:'Paid',processing:'Processing',completed:'Completed',refunded:'Refunded',cancelled:'Cancelled'};
export const COLUMN_LABELS:Record<OrderColumn,string>={identity:'Order / customer',items:'Items',payment:'Payment',fulfilment:'Fulfilment',shipping:'Shipping',waiting:'Waiting',placed:'Placed',total:'Total'};
export const ISSUE_LABELS:Record<OrderIssue,string>={address_incomplete:'Address needs review',timing_incomplete:'Timing record needs review',tracking_missing:'Tracking missing',quantity_unknown:'Packing quantity unavailable',refund_transfer_pending:'Refund transfer outstanding'};
export function paymentLabel(r:OrderWorkspaceRow):OrderLabel{
 if(r.refunded_cents>0){const outstanding=Math.max(0,r.refunded_cents-r.refund_settled_cents);return {label:r.refunded_cents>=r.total_cents?'Refund recorded':'Partial refund recorded',detail:outstanding?`${formatAud(outstanding/100)} transfer outstanding`:'Transfer recorded',tone:outstanding?'warning':'neutral'};}
 if(r.status==='pending')return {label:'Awaiting payment',detail:r.payment_ref,tone:'warning'};
 if(['paid','processing','shipped','completed'].includes(r.status)||r.paid_at)return {label:'Payment recorded',detail:r.payment_ref,tone:'neutral'};
 return {label:r.status==='cancelled'?'No payment recorded':'Payment record unavailable',detail:null,tone:'neutral'};
}
export function fulfilmentLabel(r:OrderWorkspaceRow):OrderLabel{
 const labels:Record<string,string>={pending:'Awaiting payment',paid:'Ready to pack',processing:'Packing',shipped:'Marked shipped',completed:'Completed (internal)',cancelled:'Cancelled',refunded:r.shipped_at?'Marked shipped':'No fulfilment required'};
 return {label:labels[r.status],detail:null,tone:r.status==='processing'?'info':'neutral'};
}
export function waitingLabel(r:OrderWorkspaceRow):string{
 if(!['pending','paid','processing'].includes(r.status))return '—';
 if(r.waiting_seconds===null)return r.status==='pending'?'Order time unavailable':'Payment time unavailable';
 const mins=Math.floor(r.waiting_seconds/60),days=Math.floor(mins/1440),hours=Math.floor(mins%1440/60);
 const duration=days?`${days}d${hours?` ${hours}h`:''}`:hours?`${hours}h${mins%60?` ${mins%60}m`:''}`:mins?`${mins}m`:'<1m';
 return `${duration} since ${r.status==='pending'?'order placed':'payment'}`;
}
export function physicalQuantityLabel(r:OrderWorkspaceRow):string{
 const n=['paid','processing'].includes(r.status)?r.remaining_physical_units:r.ordered_physical_units;
 return n===null?'Physical quantity unavailable':`${n} physical unit${n===1?'':'s'}`;
}
export function defaultOrderColumns(view:OrderView):OrderColumn[]{
 if(view==='pending')return ['identity','payment','waiting','total','placed'];
 if(['to_fulfil','paid','processing'].includes(view))return ['identity','items','shipping','waiting','fulfilment','total'];
 return ['identity','payment','fulfilment','shipping','placed','total'];
}
export function orderDate(value:string|null){return value&&Number.isFinite(Date.parse(value))?new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Sydney',day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(value)):'Unavailable';}
