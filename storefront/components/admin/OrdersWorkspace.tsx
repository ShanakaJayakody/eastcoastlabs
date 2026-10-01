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
import './orders-workspace.css';
export interface OrdersWorkspaceProps {params:OrderWorkspaceParams;data:OrderWorkspacePage;adminUserId:string;reinstatable?:Record<string,{recoverable:boolean;short:number}>;}
export default function OrdersWorkspace({params,data,adminUserId}:OrdersWorkspaceProps){
 const router=useRouter(),[pending,startTransition]=useTransition();
 const [preferences,setPreferences]=useState(defaultOrderPreferences),[storageNotice,setStorageNotice]=useState('');
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
 const exportHref=orderWorkspaceHref(params,{page:1,order:null,columns:null,density:null}).replace('/admin/orders?','/admin/orders/export?');
 return <section className="orders-workspace" aria-label="Orders workspace" aria-busy={pending}>
  <div className="ow-heading"><p>{data.total.toLocaleString()} orders · {VIEW_LABELS[params.status]}</p><div className="ow-actions"><Link href="/admin/orders/new">Create order</Link><a href={exportHref}>Export</a><details className="ow-disclosure"><summary>Tools</summary><div className="ow-panel"><Link href="/admin/orders/fulfilment">Stock lots and carrier CSV</Link></div></details></div></div>
  <OrderViewTabs view={params.status} counts={data.counts} onChange={status=>navigate({status})}/>
  <div className="ow-toolbar-block"><OrdersToolbar key={scope} params={params} onNavigate={navigate} pending={pending} {...layout} onColumns={columns=>{updatePreferences({...preferences,columns});navigate({columns},{resetPage:false,replace:true});}} onResetColumns={()=>{updatePreferences({...preferences,columns:null});navigate({columns:null},{resetPage:false,replace:true});}} onDensity={density=>{updatePreferences({...preferences,density});navigate({density},{resetPage:false,replace:true});}}/>
   <div className="ow-context"><span>View counts reflect current filters. Dates use Sydney time.</span><details className="ow-disclosure"><summary>Personal views</summary><div className="ow-panel"><SavedOrderViews current={params} preferences={preferences} onPreferencesChange={updatePreferences} onApply={v=>navigate({...v.filters,columns:v.columns,density:v.density,q:''})}/></div></details></div>
  </div>
  {storageNotice&&<p role="status" className="ow-secondary">{storageNotice}</p>}
  <div data-order-list-slot/>
  <div className="ow-pagination"><span>{data.total?`${(data.page-1)*25+1}–${Math.min(data.page*25,data.total)}`:'0'} of {data.total.toLocaleString()} orders</span><div><button aria-label="Previous page" disabled={data.page<=1||pending} onClick={()=>navigate({page:data.page-1},{resetPage:false})}>Previous</button><button aria-label="Next page" disabled={data.page*25>=data.total||pending} onClick={()=>navigate({page:data.page+1},{resetPage:false})}>Next</button></div></div>
 </section>;
}
