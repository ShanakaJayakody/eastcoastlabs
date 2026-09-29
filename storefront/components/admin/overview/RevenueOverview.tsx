"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {CalendarDays,TrendingUp,TrendingDown,CircleHelp} from 'lucide-react';
import {loadOverviewRevenue} from '@/app/admin/(dashboard)/overview-actions';
import {overviewWindow} from '@/lib/admin/overview/calendar';
import type {OverviewRange,RevenueOverviewData} from '@/lib/admin/overview/types';
import RevenuePlot,{money} from './RevenuePlot';
export function rangeFromParams(params:URLSearchParams):OverviewRange{
 const kind=params.get('range');
 if(kind==='custom')return {kind,from:params.get('from')??'',to:params.get('to')??''};
 return {kind:kind==='today'||kind==='month'?kind:'week'};
}
export default function RevenueOverview({initial}:{initial:RevenueOverviewData}){
 const [data,setData]=useState(initial),[choice,setChoice]=useState(initial.range.kind),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [compare,setCompare]=useState(true),[figures,setFigures]=useState(false),[help,setHelp]=useState(false),[custom,setCustom]=useState(false),[from,setFrom]=useState(''),[to,setTo]=useState('');
 const request=useRef(0),seed=useRef(initial);
 useEffect(()=>{if(seed.current!==initial){seed.current=initial;request.current++;setData(initial);setChoice(initial.range.kind);setBusy(false);setError('');}},[initial]);
 const change=useCallback(async(range:OverviewRange,push=true)=>{
  try{overviewWindow(range,new Date());}catch(e){setError(e instanceof Error?e.message:'Invalid dates');return;}
  const ticket=++request.current;setChoice(range.kind);setBusy(true);setError('');setCustom(false);
  try{
   const result=await loadOverviewRevenue(range);if(ticket!==request.current)return;
   setData(result);
   if(push){const url=new URL(window.location.href);url.searchParams.set('range',range.kind);url.searchParams.delete('from');url.searchParams.delete('to');if(range.kind==='custom'){url.searchParams.set('from',range.from);url.searchParams.set('to',range.to);}window.history.pushState({},'',url);}
  }catch{if(ticket===request.current)setError('Could not refresh revenue. Showing the last successful result.');}
  finally{if(ticket===request.current)setBusy(false);}
 },[]);
 useEffect(()=>{const sequence=request;const pop=()=>{void change(rangeFromParams(new URLSearchParams(window.location.search)),false);};window.addEventListener('popstate',pop);return()=>{sequence.current++;window.removeEventListener('popstate',pop);};},[change]);
 const diff=data.totalCents-data.previousTotalCents;
 return <section className="revenue-stage" aria-labelledby="paid-revenue-heading" aria-busy={busy}>
  <div className="revenue-toolbar"><div className="revenue-title"><h2 id="paid-revenue-heading"><span/>Paid revenue</h2><button aria-label="About paid revenue" aria-expanded={help} onClick={()=>setHelp(!help)}><CircleHelp size={17}/></button></div>
   <label className="revenue-select"><CalendarDays size={16}/><select aria-label="Revenue period" value={custom?'custom':choice} onChange={e=>{if(e.target.value==='custom'){setCustom(true);setError('');}else void change({kind:e.target.value as 'today'|'week'|'month'});}}><option value="today">Today</option><option value="week">Last 7 days</option><option value="month">Month to date</option><option value="custom">Custom dates</option></select></label>
  </div>
  {help&&<p className="revenue-explanation">Paid order totals after discounts, including recorded shipping and tax, before refunds. Counted on payment date. Not profit or a bank balance. Unpaid orders are excluded. AUD · Melbourne time.</p>}
  {custom&&<form className="revenue-custom" onSubmit={e=>{e.preventDefault();void change({kind:'custom',from,to});}}><label>Start date<input required type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>End date<input required type="date" value={to} onChange={e=>setTo(e.target.value)}/></label><button type="submit">Apply dates</button><button type="button" onClick={()=>setCustom(false)}>Cancel</button><small>Up to 366 completed days.</small></form>}
  {error&&<p className="revenue-error" role="alert">{error}</p>}
  <div className="revenue-headline"><div><div className="revenue-value" data-testid="revenue-total">{money(data.totalCents)}<span>AUD</span></div><div className={`revenue-growth ${diff<0?'down':''}`}>{diff<0?<TrendingDown size={16}/>:<TrendingUp size={16}/>}<strong>{data.changePercent===null?'No prior baseline':`${data.changePercent>0?'+':''}${data.changePercent.toFixed(1)}%`}</strong><span>vs comparison period</span></div></div><div className="revenue-support"><div><span>Paid orders</span><strong>{data.paidOrderCount}</strong></div><div><span>Avg. order</span><strong>{money(data.averageCents)}</strong></div></div></div>
  <label className="revenue-compare"><input type="checkbox" checked={compare} onChange={e=>setCompare(e.target.checked)}/>Compare previous period</label>
  <RevenuePlot data={data} compare={compare}/>
  <p className="revenue-period-note"><strong>{data.window.label}</strong> · vs {data.window.comparisonLabel}<span>{data.window.timing}</span><span>{busy?'Refreshing…':`Updated ${new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Melbourne',dateStyle:'medium',timeStyle:'short'}).format(new Date(data.asOf))} · AUD`}</span></p>
  <div className="revenue-insight"><span><strong>{money(Math.abs(diff))} {diff<0?'below':'ahead of'}</strong> the comparison period</span><button aria-expanded={figures} onClick={()=>setFigures(!figures)}>{figures?'Hide figures':'View figures'}</button></div>
  {figures&&<div className="revenue-figures"><table aria-label="Revenue figures"><thead><tr><th>Current interval</th><th>Paid revenue</th><th>Previous interval</th><th>Paid revenue</th></tr></thead><tbody>{data.points.map((p,i)=><tr key={i}><th>{p.label}</th><td>{money(p.cents)}</td><th>{p.previousLabel}</th><td>{money(p.previousCents)}</td></tr>)}</tbody><tfoot><tr><th>Total</th><td>{money(data.totalCents)}</td><th>Total</th><td>{money(data.previousTotalCents)}</td></tr></tfoot></table></div>}
 </section>;
}
