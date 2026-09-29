import {Sparkles} from 'lucide-react';
import type {RevenueOverviewData} from '@/lib/admin/overview/types';
import {localDay} from '@/lib/admin/overview/calendar';
import {formatAud} from '@/lib/format';
export default function ProgressHighlight({month}:{month:RevenueOverviewData}){
 const today=localDay(new Date(month.asOf));
 const completed=month.points.filter((p,i)=>p.cents!==null&&month.window.bounds[i]&&localDay(new Date(month.window.bounds[i]!.from))<today);
 const best=[...completed].sort((a,b)=>(b.cents??0)-(a.cents??0))[0];
 return <aside className="progress-highlight"><div className="highlight-kicker">MONTH SO FAR <Sparkles size={19}/></div><h2>{formatAud(month.totalCents/100)}<span>Paid revenue before refunds</span></h2><div className="highlight-emblem" aria-hidden/><div className="highlight-detail">{best&&best.cents!>0?<><span>Strongest completed day</span><strong>{formatAud(best.cents!/100)}</strong><span>{best.label}</span></>:<><strong>{month.paidOrderCount} paid orders</strong><span>Month to date</span></>}</div><p>From your paid order ledger.<br/>Independent of the chart’s date filter.</p></aside>;
}
