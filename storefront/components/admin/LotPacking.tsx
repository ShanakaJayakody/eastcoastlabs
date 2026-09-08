'use client';
import {useId,useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import type {OrderFulfilment,LotCatalog,FulfilmentLine} from '@/lib/admin/fulfilment';
import {saveLotAssignments} from '@/app/admin/(dashboard)/orders/fulfilment-actions';
function PoolAssignments({line,orderId,editable,catalog}:{line:FulfilmentLine;orderId:string;editable:boolean;catalog:LotCatalog}){
 const id=useId(),router=useRouter(),[pending,start]=useTransition(),[error,setError]=useState(''),[saved,setSaved]=useState(false);
 const lots=catalog.lots.filter(l=>l.poolId===line.poolId);
 return <form className="space-y-3 rounded-lg border border-line p-3" onSubmit={e=>{e.preventDefault();const data=new FormData(e.currentTarget);setError('');setSaved(false);start(async()=>{
  try{const result=await saveLotAssignments(orderId,line.itemId,line.poolId,lots.map(l=>({lotId:l.id,units:Number(data.get(l.id))})).filter(l=>l.units>0),String(data.get('evidence')));
   if(!result.ok)setError(result.error);else{setSaved(true);router.refresh()}
  }catch{setError('Connection failed. Reload the current assignments before retrying.')}
 })}}>
  <h4 className="font-medium">{line.productName} · {line.variantLabel} · {line.poolName} pool</h4>
  <p className="text-sm">{line.requiredUnits} physical units required · {line.allocatedUnits} assigned</p>
  <p className="text-sm text-muted">{line.unallocatedUnits} unallocated physical units</p>
  {line.allocatedUnits>line.requiredUnits&&<p role="alert" className="text-sm text-warn">Assignments exceed the remaining packing quantity. Verify returned physical units and reduce assignments before dispatch.</p>}
  <ul className="text-sm">{line.allocations.map(a=><li key={a.lotId}>{a.lotCode}: {a.units} units · {a.coa?<a href={a.coa.url} target="_blank" rel="noreferrer" className="underline">Verified COA {a.coa.batchId}</a>:'No verified COA linked'}</li>)}</ul>
  {editable&&<fieldset disabled={pending} className="space-y-3">
   {lots.map(l=>{const current=line.allocations.find(a=>a.lotId===l.id)?.units??0;return <label key={`${l.id}-${current}`} htmlFor={`${id}-${l.id}`} className="block text-sm">{l.code} physical units<input id={`${id}-${l.id}`} name={l.id} aria-label={`${l.code} physical units`} type="number" min={0} max={Math.max(current,l.availableUnits+current)} defaultValue={current} required className="ml-3 w-24 rounded border border-line bg-bg p-2"/><span className="ml-2 text-muted">{l.availableUnits} free in lot</span></label>})}
   {!lots.length&&<p className="text-sm text-muted">Register evidenced stock lots to record assignments. This order can still be packed with explicit unallocated units.</p>}
   {!!lots.length&&<><label htmlFor={`${id}-evidence`} className="block text-sm">Physical pick or return evidence<textarea id={`${id}-evidence`} name="evidence" required minLength={3} maxLength={2000} className="block w-full rounded border border-line bg-bg p-2"/></label><p className="text-xs text-muted">Reducing an assignment makes those lot units available again. Confirm the actual units were returned to that lot; a refund alone is not return evidence.</p><button type="submit" className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-ink">{pending?'Saving…':'Save physical assignments'}</button></>}
  </fieldset>}
  {error&&<p role="alert" className="text-sm text-danger">{error}</p>}{saved&&<p role="status" className="text-sm">Physical assignments saved.</p>}
 </form>;
}
export default function LotPacking({fulfilment,catalog}:{fulfilment:OrderFulfilment;catalog:LotCatalog}){
 return <section className="space-y-3 rounded-xl border border-line bg-surface p-4"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">Physical lot packing</h3><Link href="/admin/orders/fulfilment" className="text-sm underline">Register stock lots</Link></div><p className="text-sm text-muted">Pack sizes and shared kit stock are shown as physical units. Assign only the lots actually picked.</p>{!fulfilment.editable&&<p className="text-sm">Dispatched assignments are retained as immutable parcel history.</p>}{fulfilment.lines.map(line=><PoolAssignments key={`${line.itemId}-${line.poolId}`} line={line} orderId={fulfilment.orderId} editable={fulfilment.editable} catalog={catalog}/>)}{!fulfilment.lines.length&&<p className="text-sm">No physical pool claims are recorded. Lot allocation is unknown; verify these legacy items manually.</p>}</section>;
}
