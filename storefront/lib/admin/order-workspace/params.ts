import {validDate} from '@/lib/admin/fulfilment-analytics/params';
import type {OrderColumn,OrderView,OrderWorkspaceParams,WorkspaceSort} from './types';

export const ORDER_VIEWS: OrderView[]=['to_fulfil','pending','needs_attention','shipped','all','paid','processing','completed','refunded','cancelled'];
export const ORDER_COLUMNS: OrderColumn[]=['identity','items','payment','fulfilment','shipping','waiting','placed','total'];
export const ORDER_SORTS: WorkspaceSort[]=['created_at','paid_at','waiting_seconds','order_number','total_cents','status'];
export type RawOrderParams=Record<string,string|string[]|undefined>;
export const isOrderId=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const scalar=(v:unknown)=>typeof v==='string'?v:'';
export function parseOrderWorkspaceParams(raw:RawOrderParams):OrderWorkspaceParams{
 const q=scalar(raw.q).trim().slice(0,200);
 const status=ORDER_VIEWS.includes(raw.status as OrderView)?raw.status as OrderView:raw.status===undefined&&q?'all':'to_fulfil';
 let from=validDate(raw.from)?raw.from:'';let to=validDate(raw.to)?raw.to:'';
 if(from&&to&&from>to){from='';to='';}
 const explicitSort=ORDER_SORTS.includes(raw.sort as WorkspaceSort);
 const sort=explicitSort?raw.sort as WorkspaceSort:['to_fulfil','pending','paid','processing'].includes(status)?'waiting_seconds':'created_at';
 const requested=scalar(raw.columns).split(',').filter((v):v is OrderColumn=>ORDER_COLUMNS.includes(v as OrderColumn));
 const columns:OrderColumn[]=['identity',...new Set(requested.filter(v=>v!=='identity'))];
 const page=/^\d+$/.test(scalar(raw.page))?Math.min(1000000,Math.max(1,Number(raw.page))):1;
 return {status,q,from,to,discount:scalar(raw.discount).trim().slice(0,100),shipping:raw.shipping==='express'||raw.shipping==='standard'?raw.shipping:'any',sort,dir:explicitSort&&raw.dir==='asc'?'asc':'desc',explicitSort,page,order:isOrderId(raw.order)?raw.order:null,columns:columns.length>1?columns:null,density:raw.density==='comfortable'||raw.density==='compact'?raw.density:null};
}
export function orderWorkspaceHref(current:OrderWorkspaceParams,patch:Partial<OrderWorkspaceParams>={}):string{
 const p={...current,...patch};const qs=new URLSearchParams({status:p.status});
 for(const k of ['q','from','to','discount'] as const)if(p[k])qs.set(k,p[k]);
 if(p.shipping!=='any')qs.set('shipping',p.shipping);
 if(p.explicitSort){qs.set('sort',p.sort);qs.set('dir',p.dir);}
 if(p.page>1)qs.set('page',String(p.page));
 if(p.order)qs.set('order',p.order);
 if(p.columns)qs.set('columns',p.columns.join(','));
 if(p.density)qs.set('density',p.density);
 return `/admin/orders?${qs}`;
}
export function orderWorkspaceScopeKey(p:OrderWorkspaceParams){return orderWorkspaceHref(p,{order:null,columns:null,density:null});}
const returnKeys=new Set(['status','q','from','to','discount','shipping','sort','dir','page','columns','density']);
export function safeOrdersReturnTo(raw:string|null|undefined):string{
 if(!raw||!raw.startsWith('/admin/orders')||raw.includes('\\')||raw.includes('#'))return '/admin/orders';
 try{
  const u=new URL(raw,'https://orders.invalid');
  if(u.origin!=='https://orders.invalid'||u.pathname!=='/admin/orders')return '/admin/orders';
  const values:RawOrderParams={};
  for(const [k,v]of u.searchParams){if(!returnKeys.has(k)||values[k]!==undefined)return '/admin/orders';values[k]=v;}
  return orderWorkspaceHref(parseOrderWorkspaceParams(values));
 }catch{return '/admin/orders';}
}
export function parsePackingBatch(raw:string|null|undefined):string[]|null{
 if(!raw)return null;const ids=raw.split(',');
 return ids.length<=25&&ids.every(isOrderId)&&new Set(ids).size===ids.length?ids:null;
}
export function rawOrderParams(search:URLSearchParams):RawOrderParams{
 const raw:RawOrderParams={};for(const key of new Set(search.keys())){const values=search.getAll(key);raw[key]=values.length===1?values[0]:values;}return raw;
}
