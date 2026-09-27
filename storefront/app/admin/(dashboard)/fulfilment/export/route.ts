import {requireAdmin} from '@/lib/admin/auth';
import {parseFulfilmentParams} from '@/lib/admin/fulfilment-analytics/params';
import {getFulfilmentReport,orderTimingCsv,periodTimingCsv} from '@/lib/admin/fulfilment-analytics/queries';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 await requireAdmin();
 const search=new URL(request.url).searchParams;
 const params=parseFulfilmentParams(Object.fromEntries(search));
 const asOf=search.get('asOf')??undefined;
 const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
 if(asOf&&(!Number.isFinite(Date.parse(asOf))||Date.parse(asOf)>Date.now()+60000))return new Response('Invalid report time',{status:400,headers});
 try{
  const report=await getFulfilmentReport(params,asOf);
  const kind=search.get('kind')==='periods'?'periods':'orders';
  const csv=kind==='periods'?periodTimingCsv(params,report):await orderTimingCsv(params,report);
  return new Response(csv,{headers:{...headers,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="fulfilment-${kind}-${report.to}.csv"`}});
 }catch(error){
  console.error('Fulfilment export failed',error);
  return new Response('The export could not be completed. Refresh the report and retry.',{status:503,headers});
 }
}
