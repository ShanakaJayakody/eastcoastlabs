'use client';
import {useRef,useState} from 'react';
import {bulkConfirmPayment,bulkReinstate} from '@/app/admin/(dashboard)/orders/actions';
import {orderWorkspaceHref} from '@/lib/admin/order-workspace/params';
import type {OrderWorkspaceParams,OrderWorkspaceRow} from '@/lib/admin/order-workspace/types';
import type {OrderSelection} from './useOrderSelection';
import ConfirmModal from './ConfirmModal';
export interface OrderBulkResult {action:string;done:number;failed:{id:string;error:string;orderNumber?:string}[];}
interface Props {rows:OrderWorkspaceRow[];params:OrderWorkspaceParams;selection:OrderSelection;reinstatable?:Record<string,{recoverable:boolean;short:number}>;report:OrderBulkResult|null;onResult:(r:OrderBulkResult)=>void;onDismiss:()=>void;}
export default function OrdersBulkActions({rows,params,selection,reinstatable,report,onResult,onDismiss}:Props){
 const [review,setReview]=useState<'payment'|'reinstate'|null>(null),[pending,setPending]=useState(false),busy=useRef(false);
 const selected=rows.filter(r=>selection.selectedIds.has(r.id)),payments=selected.filter(r=>r.status==='pending'),packing=selected.filter(r=>['paid','processing'].includes(r.status)),reinstate=selected.filter(r=>r.status==='cancelled'&&reinstatable?.[r.id]?.recoverable&&reinstatable[r.id].short===0);
 const eligible=review==='payment'?payments:reinstate;
 async function submit(){
  if(busy.current||!review||!eligible.length)return;busy.current=true;setPending(true);
  const targets=[...eligible],action=review==='payment'?'Payments confirmed':'Orders reinstated';
  try{
   const result=review==='payment'?await bulkConfirmPayment(targets.map(r=>r.id)):await bulkReinstate(targets.map(r=>r.id));
   const failed=result.failed??(!result.ok?targets.map(r=>({id:r.id,error:result.error??'Unable to complete action.'})):[]);
   selection.retainFailures(failed);
   onResult({action,done:('moved' in result?result.moved:('done' in result?result.done:0))??0,failed:failed.map(f=>({...f,orderNumber:targets.find(r=>r.id===f.id)?.order_number}))});
  }catch(error){const failed=targets.map(r=>({id:r.id,orderNumber:r.order_number,error:error instanceof Error?error.message:'Unable to complete action.'}));selection.retainFailures(failed);onResult({action,done:0,failed});}
  finally{busy.current=false;setPending(false);setReview(null);}
 }
 const returnTo=orderWorkspaceHref(params,{order:null});
 const packHref=packing.length?`/admin/orders/${packing[0].id}/pack?${new URLSearchParams({batch:packing.map(r=>r.id).join(','),returnTo})}`:'';
 return <>
  {selected.length>0&&<div className="ow-bulk" aria-label="Selected order actions"><strong>{selected.length} selected on this page</strong><button disabled={pending} onClick={selection.clear}>Clear selection</button><div className="ow-actions">
   {payments.length>0&&<button className="ow-primary" disabled={pending} onClick={()=>setReview('payment')}>Confirm {payments.length} payment{payments.length===1?'':'s'}</button>}
   {packing.length>0&&<a href={packHref} onClick={e=>{if(pending)e.preventDefault();}} aria-disabled={pending||undefined}>Prepare packing ({packing.length})</a>}
   {reinstate.length>0&&<button disabled={pending} onClick={()=>setReview('reinstate')}>Reinstate {reinstate.length} order{reinstate.length===1?'':'s'}</button>}
   <a href={`/admin/orders/slips?${new URLSearchParams({ids:selected.map(r=>r.id).join(',')})}`} target="_blank" rel="noopener noreferrer">Print {selected.length} slips</a>
  </div><p className="ow-secondary">Eligible: {payments.length} awaiting payment · {packing.length} to pack · {reinstate.length} to reinstate. Each action skips the other selected orders.</p>
  {!payments.length&&!packing.length&&!reinstate.length&&<p>No selected orders are eligible for payment, packing or reinstatement.</p>}
  </div>}
  <ConfirmModal open={Boolean(review)} title={review==='payment'?'Confirm selected payments?':'Reinstate selected orders?'} confirmLabel={review==='payment'?'Confirm payments':'Reinstate orders'} pending={pending} confirmDisabled={!eligible.length} onCancel={()=>setReview(null)} onConfirm={()=>void submit()} body={<div><p>{eligible.length} eligible; {selected.length-eligible.length} skipped.</p><p>{eligible.map(r=>r.order_number).join(', ')}</p><p>{review==='payment'?'Confirm the bank transfers before continuing. Records payment, commits stock, and queues customer receipts.':'Records these cancelled orders as paid using the existing stock checks and queues the applicable customer receipt.'}</p></div>}/>
  {report&&<div className="ow-bulk-report" role="status"><div className="ow-heading"><strong>{report.action}: {report.done} succeeded · {report.failed.length} failed</strong><button onClick={onDismiss}>Dismiss results</button></div>{report.failed.map(f=><p key={f.id}><a href={`/admin/orders/${f.id}?${new URLSearchParams({returnTo})}`}>{f.orderNumber??'Open order'}</a> — <span>{f.error}</span></p>)}</div>}
 </>;
}
