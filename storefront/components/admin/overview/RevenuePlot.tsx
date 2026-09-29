"use client";
import {useId,useRef,useState} from 'react';
import type {RevenueOverviewData} from '@/lib/admin/overview/types';
export const money=(cents:number|null)=>cents===null?'—':new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(cents/100);
export default function RevenuePlot({data,compare}:{data:RevenueOverviewData;compare:boolean}){
 const id=useId(),refs=useRef<(HTMLButtonElement|null)[]>([]),[selected,setSelected]=useState(0);
 const available=data.points.flatMap((p,i)=>p.cents===null?[]:[i]),current=available.includes(selected)?selected:(available[0]??0),point=data.points[current];
 const max=Math.max(100,...data.points.flatMap(p=>[p.cents??0,compare?p.previousCents??0:0]));
 const x=(i:number)=>data.points.length===1?500:i/(data.points.length-1)*1000,y=(c:number)=>210-c/max*190;
 const segments=(field:'cents'|'previousCents')=>{
  const result:{i:number;c:number}[][]=[];let segment:{i:number;c:number}[]=[];
  data.points.forEach((p,i)=>{if(p[field]===null){if(segment.length)result.push(segment);segment=[];}else segment.push({i,c:p[field]!});});
  if(segment.length)result.push(segment);return result;
 };
 return <div className="revenue-plot-block">
  <output role="status" className="revenue-readout">{point?.label??'No completed interval'} <strong>{money(point?.cents??null)}</strong>{compare&&<span> · {point?.previousLabel}: {money(point?.previousCents??null)}</span>}</output>
  <div className="revenue-chart">
   <div className="revenue-axis" aria-hidden>{[1,.5,0].map(n=><span key={n}>{money(max*n)}</span>)}</div>
   <div className="revenue-plot">
    <svg viewBox="0 0 1000 220" preserveAspectRatio="none" aria-hidden>
     <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--color-accent)" stopOpacity=".22"/><stop offset="1" stopColor="var(--color-accent)" stopOpacity=".01"/></linearGradient></defs>
     {[20,115,210].map(n=><line key={n} x1="0" x2="1000" y1={n} y2={n} stroke="var(--color-line)" vectorEffect="non-scaling-stroke"/>)}
     {segments('cents').map((s,i)=><polygon key={i} points={`${x(s[0].i)},210 ${s.map(p=>`${x(p.i)},${y(p.c)}`).join(' ')} ${x(s.at(-1)!.i)},210`} fill={`url(#${id})`}/>)}
     {compare&&segments('previousCents').map((s,i)=><polyline key={i} data-testid="comparison-line" points={s.map(p=>`${x(p.i)},${y(p.c)}`).join(' ')} fill="none" stroke="var(--color-muted)" strokeWidth="1.5" strokeDasharray="5 6" vectorEffect="non-scaling-stroke"/>)}
     {segments('cents').map((s,i)=><polyline key={i} points={s.map(p=>`${x(p.i)},${y(p.c)}`).join(' ')} fill="none" stroke="var(--color-accent)" strokeWidth="3" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>)}
    </svg>
    {available.map(i=><button ref={node=>{refs.current[i]=node;}} key={i} className="revenue-point" style={{left:x(i)/10+'%',top:y(data.points[i].cents!)/220*100+'%'}} tabIndex={i===current?0:-1} aria-label={`${data.points[i].label}: ${money(data.points[i].cents)} paid revenue`} aria-pressed={i===current} onFocus={()=>setSelected(i)} onMouseEnter={()=>setSelected(i)} onClick={()=>setSelected(i)} onKeyDown={e=>{
     let next=available.indexOf(i);
     if(e.key==='ArrowRight')next=Math.min(next+1,available.length-1);else if(e.key==='ArrowLeft')next=Math.max(0,next-1);else if(e.key==='Home')next=0;else if(e.key==='End')next=available.length-1;else return;
     e.preventDefault();setSelected(available[next]);refs.current[available[next]]?.focus();
    }}><span/></button>)}
    <div className="revenue-x-axis" aria-hidden>{[...new Set([0,Math.floor((data.points.length-1)/2),data.points.length-1])].map(i=><span key={i}>{data.points[i]?.label}</span>)}</div>
   </div>
  </div>
 </div>;
}
