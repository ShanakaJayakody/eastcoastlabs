"use client";
import {useEffect,useRef,useState} from 'react';
import {METRICS,type FulfilmentParams,type Period} from '@/lib/admin/fulfilment-analytics/types';
import {duration,periodLabel} from '@/lib/admin/fulfilment-analytics/format';
import {fulfilmentHref} from '@/lib/admin/fulfilment-analytics/params';

export default function TrendCharts({periods,params}:{periods:Period[];params:FulfilmentParams}){
 const ref=useRef<HTMLDivElement>(null);const [width,setWidth]=useState(640);
 useEffect(()=>{if(!ref.current)return;const observer=new ResizeObserver(([entry])=>setWidth(Math.max(240,entry.contentRect.width)));observer.observe(ref.current);return()=>observer.disconnect();},[]);
 const left=46,right=22,top=16,bottom=40,height=164,plotHeight=height-top-bottom;
 const max=Math.max(1,...periods.flatMap(p=>METRICS.map(m=>(p[m.key][params.stat]??0)/86400)))*1.12;
 const x=(i:number)=>left+(periods.length===1?.5:i/(periods.length-1))*(width-left-right);
 const y=(value:number)=>top+(1-value/max)*plotHeight;
 const ticks=[0,max/2,max];
 const countMax=Math.max(1,...periods.map(p=>p.shipped_count));
 const tickIndices=[...new Set([0,Math.round((periods.length-1)/2),periods.length-1])].filter(i=>i>=0);
 return <div ref={ref} className="space-y-5">
  {METRICS.map(metric=>{
   let pen=false;const path=periods.map((p,i)=>{const value=p[metric.key][params.stat];if(value==null){pen=false;return '';}const command=pen?'L':'M';pen=true;return `${command}${x(i)},${y(value/86400)}`;}).join(' ');
   return <section key={metric.key} className="border-b border-line pb-3 last:border-0"><div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="text-sm font-medium text-fg">{metric.label}</h3><span className="text-xs text-muted">{metric.basis} · elapsed days</span></div>
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${metric.label}, ${params.stat} elapsed days by ${params.grain}; select a point to view its orders`} className="mt-2 overflow-visible">
     {ticks.map(t=><g key={t}><line x1={left} x2={width-right} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeWidth="1"/><text x={left-8} y={y(t)+4} textAnchor="end" fill="var(--color-muted)" fontSize="11">{t.toFixed(1)}</text></g>)}
     <path d={path} fill="none" stroke={metric.key==='fulfilment'?'var(--color-accent)':'var(--color-accent-2)'} strokeWidth="2" strokeLinecap="round"/>
     {periods.map((p,i)=>{const value=p[metric.key][params.stat];if(value==null)return null;const label=`${periodLabel(p.key,params.grain)}: ${duration(value)}, ${p[metric.key].n} orders${p.partial.length?', partial period':''}`;return <a key={p.key} href={fulfilmentHref(params,{tab:'orders',view:metric.key==='payment'?'payments':'shipments',metric:metric.key,period:p.key,sort:'milestone'})} aria-label={label}><title>{label}</title><circle cx={x(i)} cy={y(value/86400)} r={15} fill="transparent"/><circle cx={x(i)} cy={y(value/86400)} r={p.key===params.period?5:3.5} fill={p.partial.length?'var(--color-surface)':'var(--color-accent)'} stroke="var(--color-accent)" strokeWidth="1.5"/></a>;})}
     {tickIndices.map(i=><text key={i} x={x(i)} y={height-10} textAnchor={i===0?'start':i===periods.length-1?'end':'middle'} fill="var(--color-muted)" fontSize="11">{periodLabel(periods[i].key,params.grain)}</text>)}
    </svg>
   </section>;
  })}
  <section><h3 className="text-xs font-medium text-muted">Orders marked shipped per {params.grain}</h3><div className="mt-3 flex h-20 items-end gap-1" aria-label="Shipment volume">{periods.map(p=><a key={p.key} href={fulfilmentHref(params,{tab:'orders',view:'shipments',metric:null,period:p.key,sort:'milestone'})} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" aria-label={`${periodLabel(p.key,params.grain)}: ${p.shipped_count} marked shipped`}><span className="text-[11px] tabular-nums text-muted group-hover:text-accent">{periods.length<=24?p.shipped_count:''}</span><span className="w-full rounded-t-sm bg-accent/30 group-hover:bg-accent/60" style={{height:`${p.shipped_count/countMax*50}px`,minHeight:p.shipped_count?2:0}}/></a>)}</div></section>
  <p className="text-xs text-muted">Hollow points indicate partial periods. Gaps mean no valid observations. Select a point or volume bar to inspect its orders.</p>
 </div>;
}
