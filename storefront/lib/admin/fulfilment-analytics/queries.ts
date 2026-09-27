import 'server-only';
import {adminDb} from '@/lib/admin/db';
import {csvRow} from '@/lib/csv';
import {localDate,TIMEZONE} from './format';
import type {FulfilmentParams,FulfilmentReport,TimingPage} from './types';

async function call<T>(name:string,args:Record<string,unknown>):Promise<T>{
 const {data,error}=await adminDb().rpc(name,args);
 if(error)throw new Error(`Fulfilment analytics: ${error.message}`);
 if(data==null)throw new Error('Fulfilment analytics returned no result');
 return data as T;
}
export function getFulfilmentReport(params:FulfilmentParams,asOf?:string){
 return call<FulfilmentReport>('admin_fulfilment_report',{p_grain:params.grain,p_range:params.range,p_from:params.from,p_to:params.to,p_as_of:asOf??null});
}
export function orderScope(params:FulfilmentParams,report:FulfilmentReport):{from:string|null;to:string|null}{
 if(['waiting','unpaid','quality'].includes(params.view))return {from:null,to:null};
 const period=report.periods.find(p=>p.key===params.period);
 return period?{from:localDate(period.start_at),to:localDate(new Date(Date.parse(period.end_at)-1).toISOString())}:{from:report.from,to:report.to};
}
export function getFulfilmentOrders(params:FulfilmentParams,report:FulfilmentReport,limit=50,offset=(params.page-1)*50){
 const scope=orderScope(params,report);
 return call<TimingPage>('admin_fulfilment_orders',{p_view:params.view,p_from:scope.from,p_to:scope.to,p_sort:params.sort,p_dir:params.dir,p_offset:offset,p_limit:limit,p_as_of:report.as_of,p_metric:params.metric});
}
export async function orderTimingCsv(params:FulfilmentParams,report:FulfilmentReport):Promise<string>{
 const scope=orderScope(params,report);
 const lines=[csvRow(['order_number','customer_name','status','placed_at','paid_at','shipped_at','payment_seconds','fulfilment_seconds','total_seconds','payment_wait_seconds','fulfilment_wait_seconds','total_wait_seconds','quality_issue','view','metric','from','to','grouping','statistic','timezone','report_at'])];
 let offset=0;let expected:number|undefined;const ids=new Set<string>();
 for(;;){
  const page=await getFulfilmentOrders(params,report,500,offset);
  expected??=page.total;
  if(page.total!==expected||(page.rows.length===0&&offset<expected))throw new Error('Order history changed during export; export is incomplete. Please retry.');
  for(const o of page.rows){
   if(ids.has(o.id))throw new Error('Order history changed during export. Please retry.');ids.add(o.id);
   lines.push(csvRow([o.order_number,o.customer_name,o.status,o.created_at,o.paid_at,o.shipped_at,o.payment_seconds,o.fulfilment_seconds,o.total_seconds,o.payment_wait_seconds,o.fulfilment_wait_seconds,o.total_wait_seconds,o.quality_issue,params.view,params.metric,scope.from,scope.to,params.grain,params.stat,TIMEZONE,report.as_of]));
  }
  offset+=page.rows.length;if(offset>=expected)break;
 }
 return lines.join('\n');
}
export function periodTimingCsv(params:FulfilmentParams,report:FulfilmentReport):string{
 const rows=params.period?report.periods.filter(p=>p.key===params.period):report.periods;
 return [csvRow(['period','start_at','end_at','partial','paid_count','shipped_count','payment_valid','fulfilment_valid','total_valid','payment_seconds','fulfilment_seconds','total_seconds','grouping','statistic','timezone','report_at']),
  ...rows.map(p=>csvRow([p.key,p.start_at,p.end_at,p.partial.join(';'),p.paid_count,p.shipped_count,p.payment.n,p.fulfilment.n,p.total.n,p.payment[params.stat],p.fulfilment[params.stat],p.total[params.stat],params.grain,params.stat,TIMEZONE,report.as_of]))].join('\n');
}
