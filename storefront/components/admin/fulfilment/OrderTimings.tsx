"use client";
import {useState} from 'react';
import Link from 'next/link';
import {ChevronDown,ArrowUpRight} from 'lucide-react';
import {duration,timestamp} from '@/lib/admin/fulfilment-analytics/format';
import {fulfilmentHref} from '@/lib/admin/fulfilment-analytics/params';
import type {FulfilmentParams,TimingPage,TimingOrder} from '@/lib/admin/fulfilment-analytics/types';

function Interval({value,wait}:{value:number|null;wait:number|null}){
 return <><span className="whitespace-nowrap tabular-nums">{duration(value??wait)}</span>{value==null&&wait!=null&&<span className="ml-1 text-[11px] text-muted">so far</span>}</>;
}
function Timeline({order:o}:{order:TimingOrder}){
 const stages=[{name:'Order placed',time:o.created_at,value:o.total_seconds??o.total_wait_seconds,note:o.total_seconds==null?'Total elapsed so far':'Total to marked shipped'},
 {name:'Payment confirmed',time:o.paid_at,value:o.payment_seconds??o.payment_wait_seconds,note:o.paid_at?'After order placed':'Waiting for payment'},
 {name:'Marked shipped',time:o.shipped_at,value:o.fulfilment_seconds??o.fulfilment_wait_seconds,note:o.shipped_at?'After payment confirmed':o.paid_at?'Awaiting fulfilment':'Payment not yet confirmed'}];
 return <div className="rounded-xl border border-accent/25 bg-surface p-4" aria-label={`Timeline for ${o.order_number}`}>
  <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-sm font-medium">{o.order_number} · Order timeline</h3><Link href={`/admin/orders/${o.id}`} className="inline-flex items-center gap-1 text-xs text-accent" aria-label={`Open order ${o.order_number}`}>Open order <ArrowUpRight size={13}/></Link></div>
  <div className="mt-5 grid gap-5 sm:grid-cols-3">{stages.map(s=><div key={s.name} className="border-t-2 border-accent/50 pt-3"><div className="text-xs font-medium text-fg">{s.name}</div><div className="mt-1 text-xs leading-relaxed text-muted">{timestamp(s.time)}</div><div className="mt-3 text-lg tabular-nums text-fg">{duration(s.value)}</div><div className="text-xs text-muted">{s.note}</div></div>)}</div>
  <p className="mt-4 text-xs text-muted">Australia/Sydney · elapsed time includes weekends. Shipping records when the order was marked shipped.</p>
 </div>;
}
export default function OrderTimings({page,params,preview=false}:{page:TimingPage;params:FulfilmentParams;preview?:boolean}){
 const [selected,setSelected]=useState<string|null>(null);
 const chosen=page.rows.find(o=>o.id===selected);
 const rows=preview?page.rows.slice(0,5):page.rows;
 return <div className="space-y-4">
  <div className="overflow-x-auto rounded-lg border border-line"><table className="w-full text-left text-sm">
   <thead className="border-b border-line bg-ink-2 text-xs text-muted"><tr>{['Order / customer','Status','Placed → paid','Paid → shipped','Total elapsed',''].map((h,i)=><th className="whitespace-nowrap px-3 py-3 font-medium" key={i}>{h}</th>)}</tr></thead>
   <tbody className="divide-y divide-line">{rows.map(o=><tr key={o.id} className="hover:bg-surface/70">
    <td className="px-3 py-3"><Link href={`/admin/orders/${o.id}`} className="whitespace-nowrap font-medium text-accent">{o.order_number}</Link>{o.customer_name&&<div className="mt-0.5 max-w-40 truncate text-xs text-muted">{o.customer_name}</div>}{o.quality_issue&&<div className="mt-1 text-xs text-warn">Check timestamps</div>}</td>
    <td className="px-3 py-3"><span className="rounded bg-surface-2 px-2 py-1 text-xs text-fg-2">{o.status}</span></td>
    <td className="px-3 py-3 text-xs"><Interval value={o.payment_seconds} wait={o.payment_wait_seconds}/></td>
    <td className="px-3 py-3 text-xs"><Interval value={o.fulfilment_seconds} wait={o.fulfilment_wait_seconds}/></td>
    <td className="px-3 py-3 text-xs"><Interval value={o.total_seconds} wait={o.total_wait_seconds}/></td>
    <td className="px-3 py-3"><button type="button" onClick={()=>setSelected(selected===o.id?null:o.id)} aria-label={`Timeline for ${o.order_number}`} aria-expanded={selected===o.id} className="flex min-h-9 items-center gap-1 rounded-md px-2 text-xs text-fg-2 hover:bg-surface-2">Timeline <ChevronDown size={13}/></button></td>
   </tr>)}</tbody>
  </table>{rows.length===0&&<p className="px-4 py-10 text-center text-sm text-muted">No orders in this view.</p>}</div>
  {chosen&&<div aria-live="polite"><Timeline order={chosen}/></div>}
  {!preview&&<div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted"><span>{page.total.toLocaleString()} orders · page {params.page} of {Math.max(1,Math.ceil(page.total/50))}</span><div className="flex gap-4">{params.page>1&&<Link className="text-fg-2 hover:text-accent" href={fulfilmentHref(params,{page:params.page-1})}>Previous</Link>}{params.page*50<page.total&&<Link className="text-fg-2 hover:text-accent" href={fulfilmentHref(params,{page:params.page+1})}>Next</Link>}</div></div>}
 </div>;
}
