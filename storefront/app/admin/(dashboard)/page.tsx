import {Suspense} from 'react';
import Link from 'next/link';
import {ArrowUpRight,BellRing,Star,FlaskConical,Mail} from 'lucide-react';
import {requireAdmin} from '@/lib/admin/auth';
import {supabaseAdmin} from '@/lib/supabase';
import {adminDb} from '@/lib/admin/db';
import {lowStockVariants} from '@/lib/admin/products';
import {anomalyNudges,attentionQueue} from '@/lib/admin/attention';
import {queuedEmailCount} from '@/lib/admin/email';
import {listAbandonedCarts} from '@/lib/admin/cart-recovery';
import {getOverviewRevenue} from '@/lib/admin/overview/queries';
import type {OverviewRange} from '@/lib/admin/overview/types';
import {dailyQuote} from '@/lib/admin/daily-quote';
import {formatAud} from '@/lib/format';
import DailyQuote from '@/components/admin/overview/DailyQuote';
import RevenueOverview from '@/components/admin/overview/RevenueOverview';
import ProgressHighlight from '@/components/admin/overview/ProgressHighlight';
import OpenWork from '@/components/admin/overview/OpenWork';
import OverviewSection,{SectionFailure} from '@/components/admin/overview/OverviewSection';
import ActionQueue from '@/components/admin/ActionQueue';
import Nudges from '@/components/admin/Nudges';
import Badge from '@/components/admin/Badge';
import '@/components/admin/overview/overview.css';
export const dynamic='force-dynamic';
interface AuditRow{actor_email:string;action:string;created_at:string}
const cents=(c:number)=>formatAud(c/100);
function Loading({title}:{title:string}){return <div className="overview-loading" role="status">Loading {title}…</div>;}
export default async function AdminDashboard({searchParams}:{searchParams:Promise<{range?:string;from?:string;to?:string}>}){
 await requireAdmin();const sp=await searchParams,now=new Date();
 const range:OverviewRange=sp.range==='custom'?{kind:'custom',from:sp.from??'',to:sp.to??''}:{kind:sp.range==='today'||sp.range==='month'?sp.range:'week'};
 return <div className="admin-today">
  <div className="today-heading"><DailyQuote initial={dailyQuote(now)}/><Link className="overview-button" href="/admin/orders">Open orders <ArrowUpRight size={17}/></Link></div>
  <OverviewSection title="Operational alerts"><Suspense fallback={null}><NudgeSection/></Suspense></OverviewSection>
  <div className="overview-grid">
   <div className="overview-revenue"><OverviewSection title="Paid revenue"><Suspense fallback={<Loading title="revenue"/>}><RevenueSection range={range} now={now}/></Suspense></OverviewSection></div>
   <div className="overview-highlight"><OverviewSection title="Month summary"><Suspense fallback={<Loading title="month summary"/>}><HighlightSection now={now}/></Suspense></OverviewSection></div>
   <div className="overview-work"><OverviewSection title="Open work"><Suspense fallback={<Loading title="open work"/>}><WorkSection/></Suspense></OverviewSection></div>
  </div>
  <OverviewSection title="Oldest paid orders"><Suspense fallback={<Loading title="orders"/>}><OldestOrders/></Suspense></OverviewSection>
  <details className="overview-secondary"><summary>Payments, reviews & restock priorities</summary><OverviewSection title="Priorities"><Suspense fallback={<Loading title="priorities"/>}><AttentionSection/></Suspense></OverviewSection></details>
  <details className="overview-secondary"><summary>Recovery, pipeline & recent activity</summary><OverviewSection title="Activity"><Suspense fallback={<Loading title="activity"/>}><PanelsSection/></Suspense></OverviewSection></details>
 </div>;
}
async function RevenueSection({range,now}:{range:OverviewRange;now:Date}){try{return <RevenueOverview initial={await getOverviewRevenue(range,now)}/>;}catch{return <SectionFailure title="Paid revenue"/>;}}
async function HighlightSection({now}:{now:Date}){try{return <ProgressHighlight month={await getOverviewRevenue({kind:'month'},now)}/>;}catch{return <SectionFailure title="Month summary"/>;}}
async function NudgeSection(){try{return <Nudges nudges={await anomalyNudges()}/>;}catch{return <SectionFailure title="Operational alerts"/>;}}
async function AttentionSection(){try{return <ActionQueue queue={await attentionQueue()}/>;}catch{return <SectionFailure title="Priorities"/>;}}
async function WorkSection(){
 try{
  const db=adminDb();
  const [paid,pending,stock]=await Promise.all([db.from('orders').select('id',{count:'exact',head:true}).in('status',['paid','processing']),db.from('orders').select('id',{count:'exact',head:true}).eq('status','pending'),lowStockVariants()]);
  if(paid.error||pending.error)throw Error('Queue count unavailable');
  return <OpenWork counts={{toFulfil:paid.count??0,pendingPayment:pending.count??0,lowStock:stock.length}}/>;
 }catch{return <SectionFailure title="Open work"/>;}
}
async function OldestOrders(){
 try{
  const {data,error}=await adminDb().from('orders').select('id,order_number,customer_name,status,total_cents,paid_at,created_at').in('status',['paid','processing']).order('paid_at',{ascending:true,nullsFirst:false}).order('created_at',{ascending:true}).order('id',{ascending:true}).limit(5);
  if(error)throw error;
  return <section className="oldest-orders"><header><h2>Ready to move</h2><Link href="/admin/orders?status=to_fulfil">View all orders →</Link></header><p className="queue-definition">Oldest payment first · orders without a payment timestamp follow by creation date.</p>
   {!data?.length?<p className="queue-empty">No paid orders waiting for dispatch.</p>:<div className="overview-table-scroll"><table><thead><tr><th>Order</th><th>Customer</th><th>Payment recorded</th><th>Status</th><th>Total</th></tr></thead><tbody>{data.map(o=><tr key={o.id}><td><Link href={`/admin/orders/${o.id}`}>{o.order_number}</Link></td><td>{o.customer_name||'—'}</td><td>{o.paid_at?new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Melbourne',dateStyle:'medium'}).format(new Date(o.paid_at)):'Not recorded'}</td><td><Badge tone="info">{o.status}</Badge></td><td>{cents(o.total_cents)}</td></tr>)}</tbody></table></div>}
  </section>;
 }catch{return <SectionFailure title="Oldest paid orders"/>;}
}

async function PanelsSection() {
  try{return await PanelData();}catch{return <SectionFailure title="Activity"/>;}
}
async function PanelData() {
  const admin = supabaseAdmin();
  if(!admin)throw new Error('Activity unavailable');

  const tableCount = async (table: string): Promise<number> => {
    const { count, error } = await admin.from(table).select("*", { count: "exact", head: true });
    if(error)throw new Error('Activity count unavailable');
    return count ?? 0;
  };
  const pendingReviewCount = async (): Promise<number> => {
    const { count, error } = await admin
      .from("reviews")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");
    if(error)throw new Error('Review count unavailable');
    return count ?? 0;
  };
  const recentActivity = async (): Promise<AuditRow[]> => {
    const { data, error } = await admin
      .from("admin_audit_log")
      .select("actor_email, action, created_at")
      .order("created_at", { ascending: false })
      .limit(8);
    if(error)throw new Error('Recent activity unavailable');
    return (data ?? []) as AuditRow[];
  };

  const [
    lowStock,
    waitlist,
    subscribers,
    pendingReviews,
    coas,
    queuedEmails,
    abandonedCarts,
    events,
  ] = await Promise.all([
    lowStockVariants(),
    tableCount("stock_notifications"),
    tableCount("subscribers"),
    pendingReviewCount(),
    tableCount("coa_batches"),
    queuedEmailCount(),
    listAbandonedCarts(1, 5),
    recentActivity(),
  ]);

  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Low stock detail */}
        <section className="admin-card rounded-xl lg:col-span-2">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h3 className="text-sm font-semibold text-fg">Low stock</h3>
            <Link href="/admin/products?low=1" className="text-xs text-accent-2 hover:underline">
              Manage
            </Link>
          </div>
          <div className="divide-y divide-line">
            {lowStock.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted">Everything is above its threshold.</p>
            ) : (
              lowStock.slice(0, 8).map((v) => (
                <div
                  key={v.sku}
                  className="flex items-center justify-between px-4 py-2.5 text-sm transition hover:bg-surface-2/50"
                >
                  <div>
                    <Link href={`/admin/products/${v.slug}`} className="text-fg-2 hover:text-accent">
                      {v.productName}
                    </Link>
                    <span className="block text-xs text-muted">
                      {v.label} · <span className="font-mono">{v.sku}</span>
                    </span>
                  </div>
                  <Badge tone={v.available <= 0 ? "danger" : "warn"}>
                    {v.available} left (min {v.threshold})
                  </Badge>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Growth + trust */}
        <div className="space-y-6">
          <section className="admin-card rounded-xl p-4">
            <h3 className="text-sm font-semibold text-fg">Pipeline</h3>
            <ul className="mt-3 space-y-3 text-sm">
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-fg-2">
                  <BellRing size={15} className="text-accent" /> Restock waitlist
                </span>
                <span className="font-medium tabular-nums text-fg">{waitlist}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-fg-2">
                  <Mail size={15} className="text-accent-2" /> Emails queued
                </span>
                <span className="font-medium tabular-nums text-fg">{queuedEmails}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-fg-2">
                  <Mail size={15} className="text-muted" /> Subscribers
                </span>
                <span className="font-medium tabular-nums text-fg">{subscribers}</span>
              </li>
            </ul>
          </section>

          <section className="admin-card rounded-xl p-4">
            <h3 className="text-sm font-semibold text-fg">Trust signals</h3>
            <ul className="mt-3 space-y-3 text-sm">
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-fg-2">
                  <FlaskConical size={15} className="text-accent" /> COAs published
                </span>
                <span className="font-medium tabular-nums text-fg">{coas}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-fg-2">
                  <Star size={15} className="text-warn" /> Reviews to moderate
                </span>
                <span className="font-medium tabular-nums text-fg">{pendingReviews}</span>
              </li>
            </ul>
          </section>
        </div>
      </div>

      {abandonedCarts.length > 0 && (
        <section className="admin-card rounded-xl">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h3 className="text-sm font-semibold text-fg">Abandoned carts</h3>
            <Link href="/admin/recovery" className="text-xs text-accent-2 hover:underline">
              Recovery centre
            </Link>
          </div>
          <div className="divide-y divide-line">
            {abandonedCarts.map((c) => (
              <div
                key={c.email}
                className="flex items-center justify-between px-4 py-2.5 text-sm transition hover:bg-surface-2/50"
              >
                <div>
                  <span className="text-fg-2">{c.email}</span>
                  <span className="block text-xs text-muted">
                    Idle since {new Date(c.updated_at).toLocaleString("en-AU")}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-medium tabular-nums text-fg">{cents(c.subtotal_cents)}</span>
                  <span className="block text-xs text-muted-2">
                    {c.reminder_sent_at ? "reminder sent" : "not yet reminded"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="admin-card rounded-xl">
        <div className="border-b border-line px-4 py-3">
          <h3 className="text-sm font-semibold text-fg">Recent activity</h3>
        </div>
        <div className="divide-y divide-line">
          {events.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">No admin activity yet.</p>
          ) : (
            events.map((e, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-4 py-2.5 text-sm transition hover:bg-surface-2/50"
              >
                <div className="flex items-center gap-2">
                  <Badge tone="info">{e.action}</Badge>
                  <span className="text-fg-2">{e.actor_email}</span>
                </div>
                <span className="text-xs text-muted">
                  {new Date(e.created_at).toLocaleString("en-AU")}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
