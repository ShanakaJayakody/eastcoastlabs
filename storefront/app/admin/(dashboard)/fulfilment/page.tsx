import type {Metadata} from 'next';
import {requireAdmin} from '@/lib/admin/auth';
import {getFulfilmentReport,getFulfilmentOrders} from '@/lib/admin/fulfilment-analytics/queries';
import {parseFulfilmentParams} from '@/lib/admin/fulfilment-analytics/params';
import FulfilmentDashboard from '@/components/admin/fulfilment/FulfilmentDashboard';
export const metadata:Metadata={title:'Fulfilment — ECL Admin'};
export const dynamic='force-dynamic';
export default async function FulfilmentPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 await requireAdmin();
 const params=parseFulfilmentParams(await searchParams);
 const report=await getFulfilmentReport(params);
 const orderParams=params.tab==='overview'?{...params,view:params.view==='unpaid'?'unpaid' as const:'waiting' as const,metric:null,sort:'wait' as const,dir:'desc' as const,page:1}:params;
 const orders=await getFulfilmentOrders(orderParams,report);
 return <FulfilmentDashboard report={report} params={params} orders={orders}/>;
}
