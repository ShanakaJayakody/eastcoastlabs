'use client';
import {useEffect,useRef,useState} from 'react';
import type {OrderColumn,OrderWorkspaceParams,WorkspaceSort} from '@/lib/admin/order-workspace/types';
import {orderWorkspaceScopeKey} from '@/lib/admin/order-workspace/params';
import OrderColumnsControl from './OrderColumnsControl';
export type WorkspaceNavigate=(patch:Partial<OrderWorkspaceParams>,options?:{replace?:boolean;resetPage?:boolean})=>void;
const SORTS:Record<WorkspaceSort,string>={waiting_seconds:'Waiting time',created_at:'Date placed',paid_at:'Payment time',order_number:'Order number',total_cents:'Order total',status:'Status'};
export default function OrdersToolbar({params,onNavigate,pending,columns,density,onColumns,onResetColumns,onDensity}:{params:OrderWorkspaceParams;onNavigate:WorkspaceNavigate;pending:boolean;columns:OrderColumn[];density:'comfortable'|'compact';onColumns:(v:OrderColumn[])=>void;onResetColumns:()=>void;onDensity:(v:'comfortable'|'compact')=>void}){
 const [term,setTerm]=useState(params.q),[from,setFrom]=useState(params.from),[to,setTo]=useState(params.to),[discount,setDiscount]=useState(params.discount),[shipping,setShipping]=useState(params.shipping);
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const scope=orderWorkspaceScopeKey(params),appliedScope=useRef(scope),submittedScopes=useRef(new Set<string>());
 useEffect(()=>{
  if(appliedScope.current===scope)return;
  appliedScope.current=scope;
  // A search response must not replace text typed while that response was loading.
  if(submittedScopes.current.delete(scope))return;
  submittedScopes.current.clear();
  if(timer.current)clearTimeout(timer.current);
  setTerm(params.q);setFrom(params.from);setTo(params.to);setDiscount(params.discount);setShipping(params.shipping);
 },[scope,params.q,params.from,params.to,params.discount,params.shipping]);
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
 function search(value:string){if(timer.current)clearTimeout(timer.current);timer.current=null;const q=value.trim().slice(0,200),nextScope=orderWorkspaceScopeKey({...params,q,page:1});if(nextScope!==scope)submittedScopes.current.add(nextScope);onNavigate({q},{replace:true});}
 const invalid=Boolean(from&&to&&from>to);
 return <>
  <div className="ow-toolbar">
   <label className="ow-search"><span className="sr-only">Search orders</span><input type="search" value={term} placeholder="Order, customer, item or reference" onChange={e=>{const value=e.target.value;setTerm(value);if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>search(value),300);}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();search(term);}}}/></label>
   <details className="ow-disclosure"><summary>Filters</summary><form className="ow-panel ow-filters" onSubmit={e=>{e.preventDefault();if(!invalid){onNavigate({from,to,discount:discount.trim(),shipping});e.currentTarget.closest('details')?.removeAttribute('open');}}}>
    <p className="ow-secondary">Placed date · Sydney time</p><label>From date<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>To date<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>
    {invalid&&<p role="alert">End date must be on or after start date.</p>}
    <label>Discount code<input value={discount} maxLength={100} onChange={e=>setDiscount(e.target.value)}/></label><label>Shipping service<select value={shipping} onChange={e=>setShipping(e.target.value as typeof shipping)}><option value="any">Any service</option><option value="standard">Standard</option><option value="express">Express</option></select></label>
    <button type="submit" disabled={invalid}>Apply filters</button>
   </form></details>
   <label className="sr-only" htmlFor="order-sort">Sort orders</label><select id="order-sort" value={params.sort} onChange={e=>onNavigate({sort:e.target.value as WorkspaceSort,explicitSort:true})}>{Object.entries(SORTS).map(([v,label])=><option key={v} value={v}>{label}</option>)}</select>
   <label className="sr-only" htmlFor="order-sort-direction">Sort direction</label><select id="order-sort-direction" value={params.dir} onChange={e=>onNavigate({dir:e.target.value as 'asc'|'desc',explicitSort:true})}><option value="desc">Descending ↓</option><option value="asc">Ascending ↑</option></select>
   <OrderColumnsControl columns={columns} onChange={onColumns} onReset={onResetColumns}/>
   <label className="sr-only" htmlFor="order-density">Row density</label><select id="order-density" value={density} onChange={e=>onDensity(e.target.value as typeof density)}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select>
  </div>
  <div className="ow-chips">
   {params.q&&<button onClick={()=>onNavigate({q:''})} aria-label="Remove search filter">Search: {params.q} ×</button>}
   {(params.from||params.to)&&<button onClick={()=>onNavigate({from:'',to:''})} aria-label="Remove date filter">Placed: {params.from||'any date'} to {params.to||'today'} ×</button>}
   {params.discount&&<button onClick={()=>onNavigate({discount:''})} aria-label="Remove discount filter">Code: {params.discount} ×</button>}
   {params.shipping!=='any'&&<button onClick={()=>onNavigate({shipping:'any'})} aria-label="Remove shipping filter">{params.shipping==='express'?'Express':'Standard'} ×</button>}
   {(params.q||params.from||params.to||params.discount||params.shipping!=='any')&&<button onClick={()=>onNavigate({q:'',from:'',to:'',discount:'',shipping:'any'})}>Clear filters</button>}
   <span className="ow-secondary" role="status">{pending?'Updating orders…':''}</span>
  </div>
 </>;
}
