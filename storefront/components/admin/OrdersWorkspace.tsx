'use client';
import {useEffect,useRef,useState,useTransition} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import type {OrderWorkspacePage,OrderWorkspaceParams,OrderPreferences} from '@/lib/admin/order-workspace/types';
import {orderWorkspaceHref,orderWorkspaceScopeKey,parseOrderWorkspaceParams,rawOrderParams} from '@/lib/admin/order-workspace/params';
import {VIEW_LABELS} from '@/lib/admin/order-workspace/presentation';
import {defaultOrderPreferences,readOrderPreferences,writeOrderPreferences,resolveOrderLayout} from '@/lib/admin/order-workspace/preferences';
import OrdersToolbar,{type WorkspaceNavigate} from './OrdersToolbar';
import OrderViewTabs from './OrderViewTabs';
import SavedOrderViews from './SavedOrderViews';
import OrderWorkspaceTable from './OrderWorkspaceTable';
import OrderCards from './OrderCards';
import './orders-workspace.css';
export interface OrdersWorkspaceProps {params:OrderWorkspaceParams;data:OrderWorkspacePage;adminUserId:string;reinstatable?:Record<string,{recoverable:boolean;short:number}>;}
export default function OrdersWorkspace({params,data,adminUserId}:OrdersWorkspaceProps){
 const router=useRouter(),[pending,startTransition]=useTransition();
 const [preferences,setPreferences]=useState(defaultOrderPreferences),[storageNotice,setStorageNotice]=useState('');
 const [selection,setSelection]=useState<{scope:string;ids:Set<string>}>({scope:orderWorkspaceScopeKey(params),ids:new Set()});
 const latest=useRef(params);latest.current=params;
 useEffect(()=>{try{setPreferences(readOrderPreferences(adminUserId,window.localStorage));}catch{setPreferences(defaultOrderPreferences());}},[adminUserId]);
 function updatePreferences(next:OrderPreferences){setPreferences(next);try{if(!writeOrderPreferences(adminUserId,next,window.localStorage))setStorageNotice('Preferences apply for this visit. Browser storage is unavailable.');}catch{setStorageNotice('Preferences apply for this visit. Browser storage is unavailable.');}}
 const navigate:WorkspaceNavigate=(patch,options={})=>{
  const current=latest.current;const next={...current,...patch,order:null,page:options.resetPage===false?(patch.page??current.page):1};
  if(patch.status&&!next.explicitSort){next.sort=['to_fulfil','pending','paid','processing'].includes(next.status)?'waiting_seconds':'created_at';next.dir='desc';}
  const href=orderWorkspaceHref(next);latest.current=parseOrderWorkspaceParams(rawOrderParams(new URL(href,'https://orders.invalid').searchParams));
  startTransition(()=>router[options.replace?'replace':'push'](href,{scroll:false}));
 };
 const layout=resolveOrderLayout(params,preferences),scope=orderWorkspaceScopeKey(params);
 const selectedIds=selection.scope===scope?selection.ids:new Set<string>();
 function toggle(id:string){setSelection({scope,ids:new Set(selectedIds.has(id)?[...selectedIds].filter(x=>x!==id):[...selectedIds,id])});}
 const listProps={rows:data.rows,params,selectedIds,...layout,onToggle:toggle,onTogglePage:()=>setSelection({scope,ids:new Set(data.rows.every(r=>selectedIds.has(r.id))?[]:data.rows.map(r=>r.id))}),onOpen:(id:string)=>startTransition(()=>router.push(orderWorkspaceHref(params,{order:id}),{scroll:false})),onSort:(sort:OrderWorkspaceParams['sort'],dir:OrderWorkspaceParams['dir'])=>navigate({sort,dir,explicitSort:true}),dialogOpen:Boolean(params.order)};
 const exportHref=orderWorkspaceHref(params,{page:1,order:null,columns:null,density:null}).replace('/admin/orders?','/admin/orders/export?');
 return <section className="orders-workspace" aria-label="Orders workspace" aria-busy={pending}>
  <div className="ow-heading"><p>{data.total.toLocaleString()} orders · {VIEW_LABELS[params.status]}</p><div className="ow-actions"><Link href="/admin/orders/new">Create order</Link><a href={exportHref}>Export</a><details className="ow-disclosure"><summary>Tools</summary><div className="ow-panel"><Link href="/admin/orders/fulfilment">Stock lots and carrier CSV</Link></div></details></div></div>
  <OrderViewTabs view={params.status} counts={data.counts} onChange={status=>navigate({status})}/>
  <div className="ow-toolbar-block"><OrdersToolbar key={scope} params={params} onNavigate={navigate} pending={pending} {...layout} onColumns={columns=>{updatePreferences({...preferences,columns});navigate({columns},{resetPage:false,replace:true});}} onResetColumns={()=>{updatePreferences({...preferences,columns:null});navigate({columns:null},{resetPage:false,replace:true});}} onDensity={density=>{updatePreferences({...preferences,density});navigate({density},{resetPage:false,replace:true});}}/>
   <div className="ow-context"><span>View counts reflect current filters. Dates use Sydney time.</span><details className="ow-disclosure"><summary>Personal views</summary><div className="ow-panel"><SavedOrderViews current={params} preferences={preferences} onPreferencesChange={updatePreferences} onApply={v=>navigate({...v.filters,columns:v.columns,density:v.density,q:''})}/></div></details></div>
  </div>
  {storageNotice&&<p role="status" className="ow-secondary">{storageNotice}</p>}
  {data.rows.length?<><div className="ow-desktop-list"><OrderWorkspaceTable {...listProps}/></div><div className="ow-mobile-list"><OrderCards {...listProps}/></div><details className="ow-key-help"><summary>Keyboard shortcuts</summary><p>Focus a table row: j / k moves, x selects, Enter opens, Escape leaves the row. Shortcuts pause inside controls and dialogs.</p></details></>:<div className="ow-empty"><p>{params.q||params.from||params.to||params.discount||params.shipping!=='any'?'No orders match these filters.':params.status==='to_fulfil'?'Nothing to fulfil.':'No orders in this view.'}</p><p>{params.status==='to_fulfil'?'Orders appear here after payment is recorded.':'Try another view or clear the filters.'}</p></div>}
  <div className="ow-pagination"><span>{data.total?`${(data.page-1)*25+1}–${Math.min(data.page*25,data.total)}`:'0'} of {data.total.toLocaleString()} orders</span><div><button aria-label="Previous page" disabled={data.page<=1||pending} onClick={()=>navigate({page:data.page-1},{resetPage:false})}>Previous</button><button aria-label="Next page" disabled={data.page*25>=data.total||pending} onClick={()=>navigate({page:data.page+1},{resetPage:false})}>Next</button></div></div>
 </section>;
}
