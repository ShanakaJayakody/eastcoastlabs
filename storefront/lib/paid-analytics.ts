import 'server-only';
import { adminDb } from '@/lib/admin/db';

interface ClaimedAnalytics { id:string;lease_token:string;payload:unknown }
interface DeliveryResult { accepted:boolean;permanent:boolean;error:string|null }
function record(value:unknown):Record<string,unknown> {
  if (!value || typeof value!=='object' || Array.isArray(value)) throw new Error('Invalid analytics snapshot');
  return value as Record<string,unknown>;
}
function amount(value:unknown):number {
  if (typeof value!=='number' || !Number.isFinite(value) || value<0) throw new Error('Invalid analytics amount');
  return value;
}
function label(value:unknown):string {
  if (typeof value!=='string' || !value.length || value.length>100) throw new Error('Invalid analytics label');
  return value;
}
/** Reconstruct rather than forward JSON: customer, URL and arbitrary event
 * fields can never hitch a ride in a queue payload. */
function commerceBody(input:unknown) {
  const snapshot=record(input);
  if (typeof snapshot.client_id!=='string' || !/^\d{1,20}\.\d{1,20}$/.test(snapshot.client_id)) throw new Error('Missing analytics client ID');
  const micros=amount(snapshot.timestamp_micros);
  const age=Date.now()-micros/1000;
  if (!Number.isSafeInteger(micros) || age< -300_000 || age>= (72*60-1)*60_000) throw new Error('Analytics delivery window exceeded');
  if (!Array.isArray(snapshot.events) || snapshot.events.length!==1) throw new Error('Invalid analytics event');
  const event=record(snapshot.events[0]);if(!['purchase','refund'].includes(String(event.name)))throw new Error('Invalid analytics event');
  const params=record(event.params);
  const transaction=label(params.transaction_id);if(!/^[A-Za-z0-9_-]+$/.test(transaction))throw new Error('Invalid analytics transaction');
  const currency=label(params.currency);if(!/^[A-Z]{3}$/.test(currency))throw new Error('Invalid analytics currency');
  if(event.name==='refund')return {client_id:snapshot.client_id,timestamp_micros:micros,validation_behavior:'ENFORCE_RECOMMENDATIONS',
    events:[{name:'refund',params:{transaction_id:transaction,currency,value:amount(params.value),shipping:amount(params.shipping)}}]};
  if(!Array.isArray(params.items)||params.items.length===0||params.items.length>200)throw new Error('Invalid analytics items');
  const items=params.items.map(inputItem=>{
    const item=record(inputItem);const quantity=amount(item.quantity);
    if(!Number.isSafeInteger(quantity)||quantity<1)throw new Error('Invalid analytics quantity');
    return {item_id:label(item.item_id),item_name:label(item.item_name),quantity,price:amount(item.price),discount:amount(item.discount)};
  });
  const value=amount(params.value);
  if(Math.abs(items.reduce((sum,item)=>sum+item.price*item.quantity,0)-value)>0.000001)throw new Error('Invalid analytics total');
  return {client_id:snapshot.client_id,timestamp_micros:micros,validation_behavior:'ENFORCE_RECOMMENDATIONS',
    events:[{name:'purchase',params:{transaction_id:transaction,currency,value,shipping:amount(params.shipping),items}}]};
}
async function deliver(row:ClaimedAnalytics,endpoint:string):Promise<DeliveryResult> {
  let body:string;let refund=false;
  try{const snapshot=commerceBody(row.payload);refund=snapshot.events[0].name==='refund';body=JSON.stringify(snapshot)}catch{return {accepted:false,permanent:true,error:'Invalid or expired commerce snapshot'}}
  try{
    const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body,redirect:'error',signal:AbortSignal.timeout(10_000)});
    // GA's 2xx confirms transport only, not validation or reporting ingestion.
    if(response.ok)return {accepted:true,permanent:false,error:null};
    return {accepted:false,permanent:refund||response.status>=400&&response.status<500&&![408,429].includes(response.status),error:`Analytics HTTP ${response.status}`};
  }catch{
    // Provider/transport exceptions may contain the API secret in their URL.
    return refund?{accepted:false,permanent:true,error:'Refund transport outcome unknown; reconcile analytics before any correction'}:{accepted:false,permanent:false,error:'Analytics transport failed'};
  }
}

/** Optional worker. Purchase retries retain identity/time; refunds never retry
 * an ambiguous transport or expired claim. Acceptance is transport only. */
export async function drainPaidAnalytics(limit=25) {
  const counts={accepted:0,failed:0,dead:0,disabled:false};
  const secret=process.env.GA4_API_SECRET?.trim();const measurement=process.env.NEXT_PUBLIC_GA4_ID?.trim();
  if(!secret||!measurement||!/^G-[A-Z0-9]+$/.test(measurement))return {...counts,disabled:true};
  const endpoint=`https://www.google-analytics.com/mp/collect?${new URLSearchParams({measurement_id:measurement,api_secret:secret})}`;
  const maximum=Number.isFinite(limit)?Math.max(0,Math.min(100,Math.floor(limit))):25;
  for(let i=0;i<maximum;i++){
    // Claim one at a time; later items cannot age out while a prior send waits.
    const {data,error}=await adminDb().rpc('claim_paid_analytics');
    if(error)throw new Error('Cannot claim paid analytics');
    const row=(data as ClaimedAnalytics[]|null)?.[0];if(!row)break;
    const result=await deliver(row,endpoint);
    const {data:finished,error:finishError}=await adminDb().rpc('finish_paid_analytics',{
      p_id:row.id,p_lease:row.lease_token,p_accepted:result.accepted,p_permanent:result.permanent,p_error:result.error,
    });
    if(finishError||finished!==true)throw new Error('Cannot persist paid analytics outcome; lease may have expired');
    if(result.accepted)counts.accepted++;else if(!result.permanent)counts.failed++;
  }
  // Claim can retire every overdue row and return no work. Report outstanding
  // terminal failures so cron health stays failed until they are reconciled.
  const {data:dead,error:healthError}=await adminDb().rpc('paid_analytics_dead_count');
  if(healthError||typeof dead!=='number'||!Number.isSafeInteger(dead)||dead<0)throw new Error('Cannot read paid analytics health');
  counts.dead=dead;
  return counts;
}
