import Link from 'next/link';
import {requireAdmin} from '@/lib/admin/auth';
import {automationOverview,OUTBOX_STATES} from '@/lib/admin/automation';
import EmailOperationControls from '@/components/admin/EmailOperationControls';
import CronHealth from '@/components/admin/CronHealth';
export const dynamic='force-dynamic';
const age=(at:string|null)=>at?`${Math.max(0,Math.floor((Date.now()-Date.parse(at))/3_600_000))}h old`:'—';
export default async function AutomationPage({searchParams}:{searchParams:Promise<{status?:string;page?:string}>}){
 await requireAdmin();
 const sp=await searchParams;const status=OUTBOX_STATES.includes(sp.status as typeof OUTBOX_STATES[number])?sp.status!:'attention';
 const page=Math.max(1,parseInt(sp.page??'1',10)||1);
 const {summary,rows,total}=await automationOverview(status,page);
 const href=(state:string,p=1)=>`/admin/automation?${new URLSearchParams({status:state,page:String(p)})}`;
 return <div className="space-y-5">
  <h2 className="text-lg font-semibold">Automation and email queue</h2>
  <p className="text-sm text-muted">Queued and failed messages follow the scheduled retry worker. Sending messages hold a lease. Dead messages need provider reconciliation before any retry; inspect the customer’s delivery history and provider record first.</p>
  <div className="grid gap-3 sm:grid-cols-3">{summary.map(item=><Link key={item.status} href={href(item.status)} className="rounded-xl border border-line bg-surface p-4"><span className="capitalize">{item.status}</span><strong className="mx-2">{item.count}</strong><span className="block text-xs text-muted">Oldest: {age(item.oldestAt)}</span></Link>)}</div>
  <div className="flex justify-between text-sm"><Link href={href('attention')} className="underline">All active / failed work</Link><span>{rows.length?((page-1)*50+1):0}–{(page-1)*50+rows.length} of {total}</span></div>
  <div className="overflow-x-auto rounded-xl border border-line"><table className="w-full text-left text-sm"><thead><tr className="border-b border-line">{['Customer / template','State / attempts','Age / next attempt','Last error','Guarded controls'].map(label=><th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.id} className="border-b border-line"><td className="p-3"><Link className="underline" href={`/admin/customers/${encodeURIComponent(row.to_email)}`}>{row.to_email}</Link><span className="block text-xs text-muted">{row.template}</span></td><td className="p-3">{row.status} · {row.attempt_count}{row.status==='sending'&&row.lease_expires_at&&Date.parse(row.lease_expires_at)<Date.now()&&<span className="block text-warn">Lease expired — worker reconciliation due</span>}</td><td className="p-3">{age(row.created_at)}<span className="block text-xs">{row.next_attempt_at?new Date(row.next_attempt_at).toLocaleString('en-AU'):'—'}</span></td><td className="max-w-lg break-words p-3 text-xs">{row.error??'—'}</td><td className="p-3 text-xs"><EmailOperationControls id={row.id} status={row.status} providerAttemptedAt={row.provider_attempted_at} leaseExpiresAt={row.lease_expires_at} providerId={row.provider_message_id}/></td></tr>)}</tbody></table>{rows.length===0&&<p className="p-5 text-sm text-muted">No messages in this view.</p>}</div>
  <nav aria-label="Queue pages" className="flex gap-4 text-sm">{page>1&&<Link href={href(status,page-1)}>Previous page</Link>}{page*50<total&&<Link href={href(status,page+1)}>Next page</Link>}</nav>
  <CronHealth/>
 </div>;
}
