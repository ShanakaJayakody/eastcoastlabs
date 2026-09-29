import 'server-only';
import {adminDb} from '../db';
import {fetchAll} from '../paging';
import {overviewWindow} from './calendar';
import {aggregatePaidRevenue} from './revenue';
import type {PaidOrderFact,OverviewRange} from './types';
export async function getOverviewRevenue(range:OverviewRange,asOf=new Date()){
 const window=overviewWindow(range,asOf),db=adminDb();
 const from=[window.from,window.previousFrom].sort()[0],until=[window.until,window.previousUntil].sort().at(-1)!;
 const facts=await fetchAll<PaidOrderFact>((a,b)=>db.from('orders').select('id,paid_at,total_cents').not('paid_at','is',null).gte('paid_at',from).lt('paid_at',until).order('id',{ascending:true}).range(a,b),'Paid revenue');
 return aggregatePaidRevenue(facts,range,asOf);
}
