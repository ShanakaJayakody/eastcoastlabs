import {redirect} from 'next/navigation';
import {requireAdmin} from '@/lib/admin/auth';
import {reinstatabilityFor} from '@/lib/admin/orders';
import {getOrderWorkspace} from '@/lib/admin/order-workspace/queries';
import {parseOrderWorkspaceParams,orderWorkspaceHref,type RawOrderParams} from '@/lib/admin/order-workspace/params';
import OrdersWorkspace from '@/components/admin/OrdersWorkspace';
export const dynamic='force-dynamic';
export default async function OrdersPage({searchParams}:{searchParams:Promise<RawOrderParams>}){
 const session=await requireAdmin();
 const params=parseOrderWorkspaceParams(await searchParams);
 const data=await getOrderWorkspace(params);
 if(params.page!==data.page)redirect(orderWorkspaceHref(params,{page:data.page}));
 const cancelled=data.rows.filter(r=>r.status==='cancelled').map(r=>r.id);
 const reinstatable=cancelled.length?Object.fromEntries([...(await reinstatabilityFor(cancelled))].map(([id,value])=>[id,{recoverable:value.recoverable,short:value.short.length}])):undefined;
 return <OrdersWorkspace params={params} data={data} adminUserId={session.userId} reinstatable={reinstatable}/>;
}
