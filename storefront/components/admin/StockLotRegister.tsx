'use client';
import {useId,useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import type {LotCatalog} from '@/lib/admin/fulfilment';
import {registerLot} from '@/app/admin/(dashboard)/orders/fulfilment-actions';
const field='block w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm';
export default function StockLotRegister({catalog}:{catalog:LotCatalog}){
 const id=useId(),router=useRouter();
 const [pool,setPool]=useState(''),[error,setError]=useState(''),[saved,setSaved]=useState(false),[pending,start]=useTransition();
 const name=catalog.pools.find(p=>p.id===pool)?.name.toLowerCase().trim();
 return <section className="rounded-xl border border-line bg-surface p-4 space-y-3">
  <h3 className="font-semibold">Register physical stock lot</h3>
  <p className="text-sm text-muted">This records a lot within existing inventory and does not add stock. Receive new inventory first. Count physical units (vials), including stock already picked for unshipped paid orders. Never infer a batch from a certificate.</p>
  <form onSubmit={e=>{e.preventDefault();const form=e.currentTarget,data=new FormData(form);setError('');setSaved(false);start(async()=>{
   try{const result=await registerLot({poolId:pool,code:String(data.get('code')),units:Number(data.get('units')),receiptId:String(data.get('receipt'))||null,coaId:String(data.get('coa'))||null,evidence:String(data.get('evidence'))});
    if(!result.ok)setError(result.error);else{setSaved(true);form.reset();setPool('');router.refresh()}
   }catch{setError('Connection failed. Check the registered lots before retrying.')}
  })}} className="space-y-3">
   <fieldset disabled={pending} className="grid gap-3 sm:grid-cols-2">
    <label htmlFor={`${id}-pool`}>Physical stock pool<select id={`${id}-pool`} value={pool} onChange={e=>setPool(e.target.value)} required className={field}><option value="">Choose pool</option>{catalog.pools.map(p=><option key={p.id} value={p.id}>{p.name} · ledger on hand {p.onHand}</option>)}</select></label>
    <label htmlFor={`${id}-code`}>Physical lot code<input id={`${id}-code`} name="code" required maxLength={100} className={field}/></label>
    <label htmlFor={`${id}-units`}>Physical units counted<input id={`${id}-units`} name="units" type="number" min={1} max={1000000} required className={field}/></label>
    <label htmlFor={`${id}-receipt`}>Receipt evidence (optional)<select key={`receipt-${pool}`} id={`${id}-receipt`} name="receipt" className={field}><option value="">Current physical count only</option>{catalog.receipts.filter(r=>r.poolId===pool).map(r=><option key={r.id} value={r.id}>{r.createdAt.slice(0,10)} · {r.units} units · {r.id.slice(0,8)}</option>)}</select></label>
    <label htmlFor={`${id}-coa`}>Verified certificate (optional)<select key={`coa-${pool}`} id={`${id}-coa`} name="coa" className={field}><option value="">No verified certificate linked</option>{catalog.certificates.filter(c=>c.compound.toLowerCase().trim()===name).map(c=><option key={c.id} value={c.id}>{c.batchId}</option>)}</select></label>
    <label htmlFor={`${id}-evidence`}>Physical stock evidence<textarea id={`${id}-evidence`} name="evidence" required minLength={3} maxLength={2000} className={field}/></label>
    <label className="text-sm sm:col-span-2"><input type="checkbox" required/> I counted these units and checked the physical label against any selected receipt and certificate.</label>
    <button className="rounded-lg bg-accent px-3 py-2 font-semibold text-accent-ink" type="submit">{pending?'Registering…':'Register existing stock lot'}</button>
   </fieldset>
  </form>
  {error&&<p role="alert" className="text-sm text-danger">{error}</p>}{saved&&<p role="status" className="text-sm">Lot registered. Inventory totals are unchanged.</p>}
 </section>;
}
