/** Synthetic-only adapter. No server modules, production APIs, emails or carrier operations. */
import {makeWorkspaceRow,makeOrderPreview} from '../helpers/order-workspace-fixtures';
import {ORDER_VIEWS} from '@/lib/admin/order-workspace/params';
import type {OrderWorkspacePage,OrderWorkspaceParams,OrderWorkspaceRow} from '@/lib/admin/order-workspace/types';
let revision=0;
export const scenario=new URLSearchParams(window.location.search).get('fixtureMode');
const rows:OrderWorkspaceRow[]=Array.from({length:40},(_,i)=>makeWorkspaceRow({
 id:`10000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,order_number:`ECL-${1048+i}`,
 status:i<10?(i%2?'processing':'paid'):i<18?'pending':(['shipped','completed','refunded','cancelled'] as const)[i%4],
 customer_name:i===0?'Alex Sample':i===25?'A very long synthetic customer name that must remain readable on a narrow screen':`Sample Customer ${i+1}`,
 customer_email:i===25?'very.long.synthetic.address.for.layout.review@example.test':`sample${i+1}@example.test`,
 shipping_method:i%3===0?'express':'standard',payment_ref:i===0?'ref(1),20%_':`PAY-${1048+i}`,
 waiting_seconds:i<18?(40-i)*1800:null,paid_at:i>=10&&i<18?null:'2026-09-29T01:00:00Z',
 refunded_cents:i===26?1000:0,shipped_at:i>=18&&i%4<3?'2026-09-29T01:30:00Z':null,
 issue_keys:i===7?['quantity_unknown']:i===18?['tracking_missing']:i===21?['address_incomplete']:i===26?['refund_transfer_pending']:i===29?['timing_incomplete']:[],
 remaining_physical_units:i===7?null:6,line_count:i===25?12:1,
}));
export function fixtureSnapshot(){return `${window.location.search}:${revision}`;}
export function fixtureSubscribe(callback:()=>void){window.addEventListener('orders-fixture-change',callback);window.addEventListener('popstate',callback);return()=>{window.removeEventListener('orders-fixture-change',callback);window.removeEventListener('popstate',callback);};}
function emit(){revision++;window.dispatchEvent(new Event('orders-fixture-change'));}
function navigate(href:string,replace=false){const url=new URL(href,window.location.origin);if(url.pathname!=='/admin/orders')throw new Error('Fixture navigation only supports the order list');window.history[replace?'replaceState':'pushState']({},'',`/orders-workspace.html${url.search}`);emit();}
export const workspaceFixtureRouter={push:(href:string)=>navigate(href),replace:(href:string)=>navigate(href,true),refresh:emit};
export function fixturePage(p:OrderWorkspaceParams):OrderWorkspacePage{
 const scoped=rows.filter(r=>{const index=rows.indexOf(r);return (!p.q||[r.order_number,r.customer_name,r.customer_email,r.payment_ref,r.tracking_number,...r.items.map(i=>`${i.product_name} ${i.variant_label} ${i.sku}`)].join(' ').toLowerCase().includes(p.q.toLowerCase()))&&(!p.discount||(index%2===0&&p.discount.toUpperCase()==='VIP_20'))&&(p.shipping==='any'||r.shipping_method===p.shipping)&&(!p.from||(r.created_at!==null&&r.created_at.slice(0,10)>=p.from))&&(!p.to||(r.created_at!==null&&r.created_at.slice(0,10)<=p.to));});
 const member=(r:OrderWorkspaceRow,v:string)=>v==='all'||(v==='to_fulfil'?['paid','processing'].includes(r.status):v==='needs_attention'?r.issue_keys.length>0:r.status===v);
 const filtered=scoped.filter(r=>member(r,p.status)).sort((a,b)=>{const av=a[p.sort],bv=b[p.sort];if(av===null)return bv===null?a.id.localeCompare(b.id):1;if(bv===null)return -1;const result=typeof av==='number'&&typeof bv==='number'?av-bv:String(av).localeCompare(String(bv));return result*(p.dir==='asc'?1:-1)||a.id.localeCompare(b.id);});
 const page=Math.min(p.page,Math.max(1,Math.ceil(filtered.length/25)));
 return {rows:filtered.slice((page-1)*25,page*25),total:filtered.length,page,page_size:25,as_of:'2026-09-29T02:00:00Z',counts:Object.fromEntries(ORDER_VIEWS.map(v=>[v,scoped.filter(r=>member(r,v)).length])) as OrderWorkspacePage['counts']};
}
let bulkFailed=false,previewFailed=false;
export async function confirmPayment(id:string,reference?:string){await new Promise(resolve=>setTimeout(resolve,120));const row=rows.find(r=>r.id===id);if(!row||row.status!=='pending')return {ok:false,error:'Order is no longer awaiting payment.'};row.status='paid';row.payment_ref=reference??row.payment_ref;row.paid_at='2026-09-29T02:00:00Z';row.waiting_seconds=0;emit();return {ok:true};}
export async function bulkConfirmPayment(ids:string[]){const failed:{id:string;error:string}[]=[];let moved=0;for(const [i,id]of ids.entries()){if(scenario==='partial'&&!bulkFailed&&i===1){bulkFailed=true;failed.push({id,error:'Synthetic stock unavailable'});continue;}const result=await confirmPayment(id);if(result.ok)moved++;else failed.push({id,error:result.error!});}return {ok:moved>0,moved,failed};}
export async function bulkReinstate(ids:string[]){for(const id of ids){const row=rows.find(r=>r.id===id);if(row)row.status='paid';}emit();return {ok:true,done:ids.length,failed:[]};}
export async function signOut(){throw new Error('Sign out is disabled in the synthetic fixture.');}
export async function searchAdmin(){return [];}
export function installFixturePreview(){
 const realFetch=window.fetch.bind(window);
 window.fetch=async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,window.location.origin);
  const match=url.pathname.match(/^\/admin\/orders\/([^/]+)\/preview$/);
  if(!match){if(url.origin!==window.location.origin||url.pathname.startsWith('/api/'))throw new Error('External fixture request blocked');return realFetch(input,init);}
  await new Promise<void>((resolve,reject)=>{const timer=setTimeout(resolve,scenario==='race'&&match[1]===rows[0].id?600:40);init?.signal?.addEventListener('abort',()=>{clearTimeout(timer);reject(new DOMException('Aborted','AbortError'));},{once:true});});
  if(scenario==='error'&&!previewFailed){previewFailed=true;return Response.json({error:'Synthetic error'},{status:500});}
  const row=rows.find(r=>r.id===match[1]);return row?Response.json(makeOrderPreview(row)):Response.json({}, {status:404});
 };
}
