'use client';
import {useId,useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import type {CarrierPreview,CarrierOutcome} from '@/lib/admin/fulfilment';
import {previewCarrier,commitCarrier} from '@/app/admin/(dashboard)/orders/fulfilment-actions';
export default function CarrierImport(){
 const id=useId(),router=useRouter(),[csv,setCsv]=useState(''),[rows,setRows]=useState<CarrierPreview[]>([]),[selected,setSelected]=useState<string[]>([]),[outcomes,setOutcomes]=useState<CarrierOutcome[]>([]),[notify,setNotify]=useState(false),[error,setError]=useState(''),[pending,start]=useTransition();
 function reset(value:string){setCsv(value);setRows([]);setSelected([]);setOutcomes([]);setError('')}
 return <section className="space-y-3 rounded-xl border border-line bg-surface p-4">
  <h3 className="font-semibold">Carrier CSV reconciliation</h3><p className="text-sm text-muted">Upload order_number and tracking_number columns (up to 500 rows). Preview current order state, then select rows to mark shipped or fill missing tracking. Conflicting tracking must be reviewed on the order.</p>
  <fieldset disabled={pending} className="space-y-3">
   <label htmlFor={`${id}-file`} className="block text-sm">Upload carrier CSV<input id={`${id}-file`} type="file" accept=".csv,text/csv" className="ml-3" onChange={e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>1_000_000){setError('CSV is too large (maximum 1 MB)');return}start(async()=>{try{reset(await file.text())}catch{setError('Could not read CSV file')}})}}/></label>
   <label htmlFor={`${id}-csv`} className="block text-sm">Carrier CSV<textarea id={`${id}-csv`} value={csv} onChange={e=>reset(e.target.value)} rows={5} className="block w-full rounded-lg border border-line bg-bg p-2 font-mono text-xs" placeholder={'order_number,tracking_number\nECL-123,TRACK123'}/></label>
   <button type="button" disabled={!csv.trim()} className="rounded-lg border border-line px-3 py-2 text-sm" onClick={()=>{setError('');setSelected([]);setRows([]);setOutcomes([]);start(async()=>{try{const result=await previewCarrier(csv);if(result.ok)setRows(result.rows);else setError(result.error)}catch{setError('Could not preview CSV. Try again.')}})}}>Preview carrier rows</button>
  </fieldset>
  {!!rows.length&&<><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th>Select</th><th>Order</th><th>Current status</th><th>Current tracking</th><th>CSV tracking</th><th>Result</th></tr></thead><tbody>{rows.map((row,i)=>{const outcome=outcomes.find(o=>o.token===row.token);return <tr key={`${row.orderNumber}-${i}`} className="border-t border-line"><td className="py-2"><input type="checkbox" aria-label={`Select ${row.orderNumber}`} checked={!!row.token&&selected.includes(row.token)} disabled={pending||!!row.error||!row.token||!!outcome} onChange={e=>setSelected(v=>e.target.checked?[...v,row.token!]:v.filter(t=>t!==row.token))}/></td><td>{row.orderNumber}</td><td>{row.status??'Unknown'}</td><td>{row.currentTracking??'—'}</td><td>{row.trackingNumber}</td><td>{row.error??(outcome?(outcome.ok?'Committed':outcome.error):'Ready for review')}</td></tr>})}</tbody></table></div>
   <label className="block text-sm"><input type="checkbox" checked={notify} disabled={pending||outcomes.length>0} onChange={e=>setNotify(e.target.checked)}/> Queue shipping notifications</label><p className="text-xs text-muted">Notifications use the existing email queue. Already matching shipped rows do not send another email. Changed or failed rows need a new preview.</p>
   <button type="button" disabled={pending||!selected.length} className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-ink disabled:opacity-50" onClick={()=>{setError('');start(async()=>{try{const result=await commitCarrier(selected,notify);if(!result.ok)setError(result.error);else{setOutcomes(v=>[...v,...result.rows]);setSelected([]);router.refresh()}}catch{setError('Connection failed. Retry the same selected rows; committed previews are safe to replay.')}})}}>Commit selected rows</button>
  </>}
  {error&&<p role="alert" className="text-sm text-danger">{error}</p>}
 </section>;
}
