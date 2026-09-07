/**
 * Abandoned-cart capture + recovery — three touches (+1h / +24h / +72h).
 *
 * Known structural limit (SystemsThinking review): recovery matching is
 * email-only. If a shopper browses under one email and checks out under a
 * DIFFERENT email, there is no signal connecting the two identities — that cart
 * cannot be suppressed. Mitigation: each capture gets at most one send per
 * stage (reminder_stage is claimed atomically before queuing) and the
 * SAME-email completed-order case is fully suppressed via markCartRecovered().
 *
 * Stage timing anchors on updated_at (last cart activity), not on the previous
 * send — a fresh capture resets the stage counter and restarts the sequence.
 */
import { readAll } from "./read-all";
import { adminDb } from "./db";

export interface CapturedLine {
  name: string;
  variantLabel: string;
  quantity: number;
}

/** Upsert the shopper's current cart against their email. Overwrites any prior
 *  snapshot and resets the reminder gate — a fresh capture deserves a fresh window. */
export async function captureCart(
  email: string,
  cart: CapturedLine[],
  subtotalCents: number,
): Promise<string> {
 const {data,error}=await adminDb().rpc("recovery_capture",{p_email:email.trim().toLowerCase(),p_cart:cart,p_subtotal:subtotalCents});
 if(error)throw new Error(error.message);
 return String(data);
}

/** Suppress by email, but associate revenue only with a supplied capture ID. */
export async function markCartRecovered(email:string,orderId:string,episodeId?:string):Promise<void>{
 const {error}=await adminDb().rpc("recovery_complete",{p_email:email.trim().toLowerCase(),p_order:orderId,p_episode:episodeId??null});
 if(error)throw new Error(`markCartRecovered: ${error.message}`);
}

/**
 * Recovery touches with DISJOINT idle-time windows (hours since last cart
 * activity) now live in sequences.ts, shared with the admin UI so the stepper
 * predicts exactly what this sweep will do. Disjoint windows mean a cart matches
 * at most one stage per sweep, so a stale cart discovered late (first deploy,
 * cron outage) gets the single currently-due touch — never a burst of all three.
 * Carts idle past the last window get nothing: recovering a week-old cart reads
 * as surveillance, not service.
 */

/**
 * Atomically claim carts eligible for their next recovery touch and queue the
 * stage's email. UPDATE...RETURNING claims and reads in one statement — the
 * same fix applied to queueBackInStock — so an overlapping cron tick can never
 * double-queue the same cart+stage. The outbox's dedupe index is the second
 * seatbelt: relatedId carries the capture's updated_at, so re-captures start a
 * fresh sequence while a re-run of the same capture can't double-send.
 */
export async function queueAbandonedCartEmails(): Promise<number> {
  const {data,error}=await adminDb().rpc("recovery_queue_due",{p_limit:200});
  if(error)throw new Error(`queueAbandonedCartEmails: ${error.message}`);
  return Number(data??0);
}

export interface AbandonedCartRow {
  email: string;
  subtotal_cents: number;
  updated_at: string;
  reminder_sent_at: string | null;
}

/** Active (not yet recovered) carts idle past the threshold — dashboard visibility. */
export async function listAbandonedCarts(idleHours = 1, limit = 10): Promise<AbandonedCartRow[]> {
  const cutoff = new Date(Date.now() - idleHours * 60 * 60 * 1000).toISOString();
  const { data } = await adminDb()
    .from("cart_sessions")
    .select("email, subtotal_cents, updated_at, reminder_sent_at")
    .eq("status", "active")
    .lt("updated_at", cutoff)
    .order("updated_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as AbandonedCartRow[];
}

export interface RecoveryCartRow {
  episode_id?:string;
  legacy_unknown?:boolean;
  email: string;
  cart: CapturedLine[];
  subtotal_cents: number;
  status: string;
  reminder_stage: number | null;
  reminder_sent_at: string | null;
  recovered_order_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Carts for the recovery centre's three tabs. */
export async function listCartsFor(
  tab: "active" | "recovered" | "expired",
  limit = 50,
  range?: RecoveryRange,
  page = 1,
): Promise<RecoveryCartRow[]> {
  const db = adminDb();
  const deadline = new Date(Date.now() - 168 * 60 * 60 * 1000).toISOString();

  let q = db
    .from("admin_recovery_episodes")
    .select(
      "episode_id, legacy_unknown, email, cart, subtotal_cents, status, reminder_stage, reminder_sent_at, recovered_order_id, created_at, updated_at",
    )
    .order("updated_at", { ascending: false }).order("episode_id")
    .range((page-1)*limit,page*limit-1);

  if(range){const {since,until}=boundsOf(range);q=q.gte("created_at",since);if(until)q=q.lt("created_at",until);}
  if (tab === "recovered") q = q.eq("status", "recovered");
  // "Expired" is an active cart that aged past the last recovery window — the
  // sweep will never touch it again, which is precisely why it needs a list.
  else if (tab === "expired") q = q.or(`state.in.(superseded,stopped),and(state.eq.active,updated_at.lt.${deadline}),state.eq.legacy_unknown`);
  else q = q.eq("state", "active").gte("updated_at", deadline);

  const { data,error } = await q;
  if(error) throw new Error(error.message);
  return (data ?? []) as RecoveryCartRow[];
}

export interface RecoveryMetrics {
  captured:number;
  exposed:number;
  orderCreated:number;
  paid:number;
  attributedPaid:number;
  legacyUnknown:number;
  activeCarts: number;
  inSequence: number;
  recovered30d: number;
  revenueRecoveredCents: number;
  /** Recovered ÷ (recovered + still-active + expired), over carts captured in window. */
  recoveryRatePct: number | null;
}

/**
 * The window a recovery report covers.
 *
 * Either a rolling number of days (the original behaviour, kept as the default)
 * or explicit Sydney-calendar bounds from `windowMeta`, so the recovery page can
 * step through months and weeks like every other period-scoped screen.
 */
export type RecoveryRange = number | { startIso: string; endIso: string };

function boundsOf(range: RecoveryRange): { since: string; until: string | null } {
  if (typeof range === "number") {
    return { since: new Date(Date.now() - range * 86_400_000).toISOString(), until: null };
  }
  return { since: range.startIso, until: range.endIso };
}

export async function recoveryMetrics(range: RecoveryRange = 30): Promise<RecoveryMetrics> {
  const db = adminDb();
  const { since, until } = boundsOf(range);
  const idleCutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const [metricResult,activeResult,stagedResult]=await Promise.all([
    db.rpc("recovery_episode_metrics",{p_since:since,p_until:until}),
    db.from("cart_sessions").select("*",{count:"exact",head:true}).eq("status","active").lt("updated_at",idleCutoff),
    db.from("cart_sessions").select("*",{count:"exact",head:true}).eq("status","active").gt("reminder_stage",0),
  ]);
  if(metricResult.error||activeResult.error||stagedResult.error)throw new Error(metricResult.error?.message??activeResult.error?.message??stagedResult.error?.message);
  const m=metricResult.data as {captured:number;exposed:number;order_created:number;paid:number;attributed_paid:number;legacy_unknown:number;attributed_net_paid_cents:number};
  return {activeCarts:activeResult.count??0,inSequence:stagedResult.count??0,recovered30d:m.order_created,revenueRecoveredCents:m.attributed_net_paid_cents,recoveryRatePct:m.exposed>0?Math.round(m.attributed_paid/m.exposed*100):null,captured:m.captured,exposed:m.exposed,orderCreated:m.order_created,paid:m.paid,attributedPaid:m.attributed_paid,legacyUnknown:m.legacy_unknown};
}

export interface RecoveryFunnel {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
}

/**
 * Sent → delivered → opened → clicked, over recovery emails in the
 * window. Counted per EMAIL rather than per cart: one cart can receive three
 * touches, and "did this touch land" is the question the funnel answers.
 *
 * Opens are inflated by Apple Mail Privacy Protection, which fetches tracking
 * pixels unprompted — the UI labels the number as directional for that reason.
 */
export async function recoveryFunnel(range: RecoveryRange = 30): Promise<RecoveryFunnel> {
  const db = adminDb();
  const { since, until } = boundsOf(range);
  const templates = ["abandoned_cart", "abandoned_cart_2", "abandoned_cart_3"];

  const sentRows=await readAll<{id:string}>((start,end)=>{
    let q=db.from("email_outbox").select("id").in("template",templates).eq("status","sent").gte("created_at",since).order("id").range(start,end);
    if(until)q=q.lt("created_at",until);
    return q;
  });
  const ids=sentRows.map(r=>r.id);

  const counts = { delivered: 0, opened: 0, clicked: 0 };
  if (ids.length) {
    const events:{outbox_id:string;event:string}[]=[];
    for(let start=0;start<ids.length;start+=200){
      events.push(...await readAll<{outbox_id:string;event:string}>((from,to)=>db.from("email_events").select("outbox_id,event").in("outbox_id",ids.slice(start,start+200)).order("id").range(from,to)));
    }
    // Distinct outbox rows per event — a single email opened five times is one
    // open in a funnel, not five.
    const seen: Record<string, Set<string>> = { delivered: new Set(), opened: new Set(), clicked: new Set() };
    for (const e of (events ?? []) as { outbox_id: string; event: string }[]) {
      if (seen[e.event]) seen[e.event].add(e.outbox_id);
    }
    counts.delivered = seen.delivered.size;
    counts.opened = seen.opened.size;
    counts.clicked = seen.clicked.size;
  }

  return { sent:ids.length,...counts };
}

export async function abandonedCartCount(idleHours = 1): Promise<number> {
  const cutoff = new Date(Date.now() - idleHours * 60 * 60 * 1000).toISOString();
  const { count } = await adminDb()
    .from("cart_sessions")
    .select("*", { count: "exact", head: true })
    .eq("status", "active")
    .lt("updated_at", cutoff);
  return count ?? 0;
}
