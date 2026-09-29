import {overviewWindow} from './calendar';
import type {PaidOrderFact,OverviewRange,RevenueOverviewData,Interval} from './types';
export function aggregatePaidRevenue(facts:PaidOrderFact[],range:OverviewRange,now:Date):RevenueOverviewData {
 const window=overviewWindow(range,now),unique=new Map<string,PaidOrderFact>();
 for(const fact of facts){
  if(!fact.id||!fact.paid_at||!Number.isFinite(Date.parse(fact.paid_at))||!Number.isSafeInteger(fact.total_cents)||fact.total_cents<0)throw new Error('Paid revenue contains an invalid payment or total.');
  const prior=unique.get(fact.id);
  if(prior&&(Date.parse(prior.paid_at)!==Date.parse(fact.paid_at)||prior.total_cents!==fact.total_cents))throw new Error('Conflicting paid order facts.');
  unique.set(fact.id,fact);
 }
 const rows=[...unique.values()],within=(f:PaidOrderFact,b:Interval)=>Date.parse(f.paid_at)>=Date.parse(b.from)&&Date.parse(f.paid_at)<Date.parse(b.until);
 const sum=(rows:PaidOrderFact[])=>{const n=rows.reduce((a,f)=>a+f.total_cents,0);if(!Number.isSafeInteger(n))throw new Error('Revenue exceeds safe integer precision.');return n;};
 const current=rows.filter(f=>within(f,window)),previous=rows.filter(f=>within(f,{from:window.previousFrom,until:window.previousUntil}));
 const totalCents=sum(current),previousTotalCents=sum(previous);
 const points=window.bounds.map((b,i)=>({label:window.labels[i],previousLabel:window.previousLabels[i],cents:b?sum(current.filter(f=>within(f,b))):null,previousCents:window.previousBounds[i]?sum(previous.filter(f=>within(f,window.previousBounds[i]!))):null}));
 return {asOf:now.toISOString(),range,window,points,totalCents,previousTotalCents,paidOrderCount:current.length,averageCents:current.length?Math.round(totalCents/current.length):null,changePercent:previousTotalCents?(totalCents-previousTotalCents)/previousTotalCents*100:null};
}
