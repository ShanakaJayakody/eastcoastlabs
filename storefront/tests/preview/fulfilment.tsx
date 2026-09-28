import {createRoot} from 'react-dom/client';
import '../../app/globals.css';
import FulfilmentDashboard from '@/components/admin/fulfilment/FulfilmentDashboard';
import {parseFulfilmentParams} from '@/lib/admin/fulfilment-analytics/params';
import {localDate} from '@/lib/admin/fulfilment-analytics/format';
import type {FulfilmentReport,TimingPage} from '@/lib/admin/fulfilment-analytics/types';
import data from './fulfilment-data.json';
const params=parseFulfilmentParams(Object.fromEntries(new URLSearchParams(location.search)));
const report=data.reports[params.grain] as FulfilmentReport;
const view=params.tab==='overview'?(params.view==='unpaid'?'unpaid':'waiting'):params.view;
let page=data.views[view] as TimingPage;
const selected=report.periods.find(p=>p.key===params.period);
if(selected&&['payments','shipments'].includes(view)){
 const rows=page.rows.filter(o=>{const at=view==='payments'?o.paid_at:o.shipped_at;return at&&Date.parse(at)>=Date.parse(selected.start_at)&&Date.parse(at)<Date.parse(selected.end_at);});
 page={...page,rows,total:rows.length};
}
document.addEventListener('click',event=>{const href=(event.target as Element).closest('a')?.getAttribute('href');if(href?.startsWith('/admin/fulfilment?')){event.preventDefault();location.search=new URL(href,location.origin).search;}});
document.addEventListener('submit',event=>{const form=event.target as HTMLFormElement;if(form.action.endsWith('/admin/fulfilment')){event.preventDefault();location.search=new URLSearchParams(new FormData(form) as unknown as Record<string,string>).toString();}});
createRoot(document.getElementById('root')!).render(<div className="admin-theme min-h-screen bg-ink text-fg"><div className="border-b border-line px-5 py-3 text-xs text-muted">East Coast Labs · Synthetic acceptance fixture · {localDate(report.as_of)}</div><main className="mx-auto max-w-6xl p-4 sm:p-7"><FulfilmentDashboard report={report} params={params} orders={page}/></main></div>);
