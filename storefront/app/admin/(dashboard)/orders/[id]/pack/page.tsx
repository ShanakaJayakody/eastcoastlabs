import LotPacking from '@/components/admin/LotPacking';
import {getOrderFulfilment,getLotCatalog} from '@/lib/admin/fulfilment';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import type {Metadata} from 'next';
import {requireAdmin} from '@/lib/admin/auth';
import {getOrder} from '@/lib/admin/order-queries';
import {packQueuePosition,selectedPackContext} from '@/lib/admin/packing';
import {parsePackingBatch,safeOrdersReturnTo,isOrderId,type RawOrderParams} from '@/lib/admin/order-workspace/params';
import PackingMode from '@/components/admin/PackingMode';
export const metadata:Metadata={title:'Packing — ECL Admin'};
export const dynamic='force-dynamic';
export default async function PackPage({params,searchParams}:{params:Promise<{id:string}>;searchParams?:Promise<RawOrderParams>}){
 await requireAdmin();
 const {id}=await params,sp=await searchParams??{},returnTo=safeOrdersReturnTo(typeof sp.returnTo==='string'?sp.returnTo:null);
 const hasBatch=sp.batch!==undefined,ids=parsePackingBatch(typeof sp.batch==='string'?sp.batch:null);
 if(hasBatch&&(!ids||!ids.includes(id)))return <div className="space-y-4"><h2>This packing batch is invalid</h2><Link href={returnTo}>Back to orders</Link></div>;
 if(!isOrderId(id))notFound();
 const [order,batch,global]=await Promise.all([getOrder(id),hasBatch?selectedPackContext(id,ids!,returnTo):null,hasBatch?null:packQueuePosition(id)]);
 if(!order&&!hasBatch)notFound();
 const nextId=batch?.nextId??(batch?null:global?.nextId??null);
 const query=new URLSearchParams();if(batch)query.set('batch',batch.ids.join(','));if(batch||sp.returnTo)query.set('returnTo',returnTo);
 const nextHref=nextId?`/admin/orders/${nextId}/pack${query.size?`?${query}`:''}`:null;
 const exitHref=batch||sp.returnTo?returnTo:undefined;
 const skipped=batch&&batch.skippedIds.length>0?<p className="text-sm text-muted">{batch.skippedIds.length} selected order{batch.skippedIds.length===1?'':'s'} skipped because they are no longer eligible or available.</p>:null;
 if(!order||!['paid','processing'].includes(order.status))return <div className="mx-auto max-w-lg space-y-4 py-12 text-center"><h2 className="text-lg">{order?`${order.order_number} is ${order.status}`:'This selected order is no longer available'}</h2>{skipped}<div className="flex flex-wrap justify-center gap-3">{nextHref&&<Link href={nextHref}>Pack the next {batch?'selected order':'order'}</Link>}<Link href={returnTo}>Back to orders</Link>{order&&<Link href={`/admin/orders/${id}?${new URLSearchParams({returnTo})}`}>View order</Link>}</div></div>;
 const [fulfilment,catalog]=await Promise.all([getOrderFulfilment(id),getLotCatalog()]);
 return <div className="space-y-6">{skipped}<LotPacking fulfilment={fulfilment} catalog={catalog}/><PackingMode
  order={{id:order.id,orderNumber:order.order_number,customerName:order.customer_name,customerEmail:order.customer_email,address:order.shipping_address,totalCents:order.total_cents,notes:order.notes,items:order.items.map(i=>({id:i.id,productName:i.product_name,variantLabel:i.variant_label,sizeLabel:i.size_label,sku:i.sku,qty:i.qty,refundedQty:i.refunded_qty,lineTotalCents:i.line_total_cents}))}}
  nextId={nextId} nextHref={nextHref} exitHref={exitHref}
  position={batch?.originalPosition??(global&&global.index>=0?global.index+1:0)} total={batch?.originalTotal??global?.total??0}
  positionUnknown={global?global.truncated&&global.index<0:false} positionLabel={batch?`Selected batch · ${batch.originalPosition} of ${batch.originalTotal}`:undefined}
 /></div>;
}
