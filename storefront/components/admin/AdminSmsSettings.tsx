'use client';
import { useState } from 'react';
import AdminWriteButton from './AdminWriteButton';
import { saveAdminSmsSettings, previewAdminSms, testAdminSms } from '@/app/admin/(dashboard)/settings/admin-sms-actions';
import type { AdminSmsSettings as Settings, SmsOutboxRow, SmsRecipient } from '@/lib/sms/types';

type Preview={body:string;parts:number;balance:number;recipientCount:number;estimatedCredits:number;recipients:SmsRecipient[]};
export default function AdminSmsSettings({settings,history,serverEnabled,error}:{settings:Settings|null;history:SmsOutboxRow[];serverEnabled:boolean;error?:string}) {
  const [enabled,setEnabled]=useState(settings?.enabled??false);
  const [hour,setHour]=useState(settings?.start_hour??8);
  const [busy,setBusy]=useState(false),[notice,setNotice]=useState('');
  const [preview,setPreview]=useState<Preview|null>(null),[phone,setPhone]=useState('');
  const [testId,setTestId]=useState<string|null>(null);
  async function save(){
    setBusy(true);setNotice('');
    try {const result=await saveAdminSmsSettings({enabled,startHour:hour});setNotice(result.ok?'SMS settings saved.':result.error??'Could not save settings.');}
    catch {setNotice('Could not save settings. Please try again.')}finally{setBusy(false)}
  }
  async function refresh(){
    setBusy(true);setNotice('');
    try {const result=await previewAdminSms();if(result.ok&&result.preview)setPreview(result.preview as Preview);else setNotice(result.error??'Preview unavailable.');}
    catch {setNotice('Preview unavailable. Please try again.')}finally{setBusy(false)}
  }
  async function test(){
    if(!phone)return;
    const id=testId??crypto.randomUUID();setTestId(id);setBusy(true);setNotice('');
    try {const result=await testAdminSms(phone,id);setNotice(result.ok?result.message??'Test accepted.':result.error??'Test unavailable.');if(result.ok)setTestId(null);}
    catch {setNotice('The test result is uncertain. Check history before retrying.')}finally{setBusy(false)}
  }
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4" aria-labelledby="director-sms-heading">
    <div><h2 id="director-sms-heading" className="font-semibold text-lg text-slate-900">Daily director SMS</h2>
      <p className="text-sm text-slate-600">A fresh business update every day, including weekends, sent to the ECL Directors list.</p></div>
    {error&&<p role="alert" className="text-sm text-amber-800">{error}</p>}
    {!serverEnabled&&<p className="text-sm text-amber-800">SMS sending has not been activated on the server. You can still preview the update once setup is complete.</p>}
    <div className="flex flex-wrap items-center gap-4">
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)} disabled={busy||!settings}/>Daily sending enabled</label>
      <label className="text-sm">Melbourne delivery hour <select aria-label="Melbourne delivery hour" className="ml-2 rounded border border-slate-300 p-2" value={hour} onChange={e=>setHour(Number(e.target.value))} disabled={busy||!settings}>
        {Array.from({length:20},(_,h)=><option key={h} value={h}>{String(h).padStart(2,'0')}:00–{String(h+1).padStart(2,'0')}:00</option>)}
      </select></label>
      <AdminWriteButton type="button" onClick={save} disabled={busy||!settings} className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50">Save SMS settings</AdminWriteButton>
    </div>
    <p className="text-xs text-slate-500">Delivery follows Melbourne daylight saving. A delayed job can catch up within four hours of the selected start time. Each director receives at most one scheduled update per day.</p>
    <div className="flex flex-wrap items-center gap-3">
      <AdminWriteButton type="button" onClick={refresh} disabled={busy} className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50">Refresh live preview</AdminWriteButton>
      <a href="https://app.mobilemessage.com.au" target="_blank" rel="noreferrer" className="text-sm underline">Manage ECL Directors in Mobile Message</a>
    </div>
    {preview&&<div className="space-y-3">
      <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm">{preview.body}</pre>
      <p className="text-sm text-slate-600">{preview.recipientCount} directors · {preview.parts} SMS {preview.parts===1?'part':'parts'} each · estimated {preview.estimatedCredits} credits per day · {preview.balance} credits available</p>
      <ul className="text-sm text-slate-600">{preview.recipients.map(r=><li key={r.phone}>{r.name||'Director'} — +{r.phone}</li>)}</ul>
      <div className="flex flex-wrap gap-3 items-center">
        <label className="text-sm">Test recipient <select aria-label="Test recipient" value={phone} onChange={e=>{setPhone(e.target.value);setTestId(null)}} disabled={busy} className="ml-2 rounded border border-slate-300 p-2">
          <option value="">Choose one director</option>{preview.recipients.map(r=><option key={r.phone} value={r.phone}>{r.name||r.phone}</option>)}
        </select></label>
        <AdminWriteButton type="button" onClick={test} disabled={busy||!phone||!serverEnabled} className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50">Send one test SMS</AdminWriteButton>
      </div>
      <p className="text-xs text-slate-500">A test uses SMS credits and is separate from the scheduled daily update.</p>
    </div>}
    {notice&&<p role="status" className="text-sm text-slate-700">{notice}</p>}
    <div><h3 className="font-medium text-sm mb-2">Recent deliveries</h3>
      {!history.length?<p className="text-sm text-slate-500">No SMS deliveries recorded yet.</p>:<div className="overflow-x-auto"><table className="w-full text-left text-sm">
        <thead><tr className="border-b"><th className="py-2">Date</th><th>Recipient</th><th>Type</th><th>Status</th></tr></thead>
        <tbody>{history.map(row=><tr className="border-b align-top" key={row.id}><td className="py-2 pr-3">{row.local_send_date}</td><td className="pr-3">+{row.to_phone}</td><td className="pr-3">{row.kind}</td><td>{row.status}{row.last_error&&<p className="text-xs text-amber-800">{row.last_error}</p>}</td></tr>)}</tbody>
      </table></div>}
      <p className="mt-2 text-xs text-slate-500">Accepted means Mobile Message accepted the request. Delivered means all SMS parts have a delivery report.</p>
    </div>
  </section>;
}
