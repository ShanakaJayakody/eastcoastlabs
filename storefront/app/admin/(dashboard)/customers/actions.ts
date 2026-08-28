"use server";

/**
 * Sequence controls.
 *
 * Every mutation here is small on purpose. The sweeps stay the engine; these
 * actions only record operator intent (a pause row, a cancelled outbox row) or
 * pull a scheduled send forward. Nothing here duplicates scheduling logic —
 * the moment it did, the admin and the cron would start disagreeing about what
 * happens next, which is exactly the problem this feature exists to end.
 */
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { adminDb } from "@/lib/admin/db";
import { logAudit } from "@/lib/admin/audit";
import { queueEmail } from "@/lib/admin/email";
import { sendImmediately } from "@/lib/email/sender";
import { unsubscribeUrl } from "@/lib/email/unsubscribe";
import { loadPerson, deriveSequenceState } from "@/lib/admin/customer-360";
import { isTransactional, SEQUENCE_LABELS, type SequenceId } from "@/lib/admin/sequences";
import { referenceForOrderNumber } from "@/lib/payments";
import { getSettings } from "@/lib/settings";

export interface ActionResult {
  ok: boolean;
  message: string;
}

const clean = (email: string) => email.trim().toLowerCase();

function revalidate(email: string) {
  revalidatePath(`/admin/customers/${encodeURIComponent(email)}`);
  revalidatePath("/admin/customers");
  revalidatePath("/admin/recovery");
  revalidatePath("/admin");
}

/* ---------------- pause / resume ------------------------------------------ */

export async function pauseSequence(
  email: string,
  sequence: SequenceId,
  reason?: string,
): Promise<ActionResult> {
  const session = await requireAdmin();
  const to = clean(email);
  const { error } = await adminDb()
    .from("sequence_overrides")
    .upsert(
      { email: to, sequence, action: "pause", actor_email: session.email, reason: reason ?? null },
      { onConflict: "email,sequence" },
    );
  if (error) return { ok: false, message: error.message };

  await logAudit({
    actor: session.email,
    action: "sequence.pause",
    entityType: "customer",
    entityId: to,
    diff: { sequence },
  });
  revalidate(to);
  return { ok: true, message: `${SEQUENCE_LABELS[sequence]} paused for ${to}.` };
}

export async function resumeSequence(email: string, sequence: SequenceId): Promise<ActionResult> {
  const session = await requireAdmin();
  const to = clean(email);
  const { error } = await adminDb()
    .from("sequence_overrides")
    .delete()
    .eq("email", to)
    .eq("sequence", sequence);
  if (error) return { ok: false, message: error.message };

  await logAudit({
    actor: session.email,
    action: "sequence.resume",
    entityType: "customer",
    entityId: to,
    diff: { sequence },
  });
  revalidate(to);
  return { ok: true, message: `${SEQUENCE_LABELS[sequence]} resumed.` };
}

/* ---------------- skip / send-now ----------------------------------------- */

/**
 * Mark one upcoming stage as handled without sending it.
 *
 * Implemented by writing a `cancelled` outbox row at the stage's canonical
 * related id. That row then occupies the dedupe slot, so when the sweep next
 * runs and tries to queue the same stage, `ignoreDuplicates` turns it into a
 * no-op. The skip is durable without inventing a parallel skip table.
 */
export async function skipStage(
  email: string,
  sequence: SequenceId,
  stage: number,
): Promise<ActionResult> {
  const session = await requireAdmin();
  const to = clean(email);
  const target = await findStage(to, sequence, stage);
  if (!target) return { ok: false, message: "That touch is no longer pending." };

  const { error } = await adminDb().from("email_outbox").upsert(
    {
      to_email: to,
      template: target.stage.template,
      payload: { skipped_by: session.email },
      status: "cancelled",
      related_type: "sequence_skip",
      related_id: target.stage.relatedId,
    },
    { onConflict: "to_email,template,related_id", ignoreDuplicates: true },
  );
  if (error) return { ok: false, message: error.message };

  await logAudit({
    actor: session.email,
    action: "sequence.skip",
    entityType: "customer",
    entityId: to,
    diff: { sequence, stage, template: target.stage.template },
  });
  revalidate(to);
  return { ok: true, message: `${target.stage.label} skipped — it will not send.` };
}

/**
 * Fire an upcoming stage immediately.
 *
 * Uses the sweep's own related id, which makes admin and cron mutually
 * idempotent: whichever runs first claims the dedupe slot and the other becomes
 * a no-op. Marketing templates are refused for suppressed recipients and when no
 * unsubscribe URL can be minted; transactional templates are exempt from
 * suppression because an order confirmation is not marketing.
 */
export async function sendStageNow(
  email: string,
  sequence: SequenceId,
  stage: number,
): Promise<ActionResult> {
  const session = await requireAdmin();
  const to = clean(email);
  const target = await findStage(to, sequence, stage);
  if (!target) return { ok: false, message: "That touch is no longer pending." };

  const { stage: derived, state, person } = target;
  const template = derived.template;
  const marketing = !isTransactional(template);

  if (marketing) {
    if (person.summary.unsubscribedAt) {
      return { ok: false, message: "This person has unsubscribed — marketing sends are blocked." };
    }
    if (!unsubscribeUrl(to)) {
      return { ok: false, message: "No unsubscribe secret configured — marketing send refused." };
    }
  }

  const payload = await buildPayload(sequence, to, state, person);
  if (!payload) return { ok: false, message: "Could not assemble this email's content." };
  const unsub = unsubscribeUrl(to);

  await queueEmail({
    to,
    template,
    payload: marketing && unsub ? { ...payload, unsubscribe_url: unsub } : payload,
    relatedType: "admin_send",
    relatedId: derived.relatedId,
  });

  await logAudit({
    actor: session.email,
    action: "sequence.send_now",
    entityType: "customer",
    entityId: to,
    diff: { sequence, stage, template },
  });
  revalidate(to);
  return { ok: true, message: `${derived.label} queued for ${to}.` };
}

/** Terminal stop for an active cart — the recovery sweep only looks at 'active'. */
export async function stopCartRecovery(email: string): Promise<ActionResult> {
  const session = await requireAdmin();
  const to = clean(email);
  const { error } = await adminDb()
    .from("cart_sessions")
    .update({ status: "abandoned", updated_at: new Date().toISOString() })
    .eq("email", to)
    .eq("status", "active");
  if (error) return { ok: false, message: error.message };

  await logAudit({
    actor: session.email,
    action: "cart.stop_recovery",
    entityType: "customer",
    entityId: to,
  });
  revalidate(to);
  return { ok: true, message: "Cart recovery stopped for this cart." };
}

/* ---------------- outbox row controls -------------------------------------- */

export async function cancelQueuedEmail(id: string, email: string): Promise<ActionResult> {
  const session = await requireAdmin();
  const { data, error } = await adminDb()
    .from("email_outbox")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("status", "queued")
    .select("id, template")
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "Already sent — too late to cancel." };

  await logAudit({
    actor: session.email,
    action: "email.cancel",
    entityType: "email_outbox",
    entityId: id,
    diff: { template: (data as { template: string }).template },
  });
  revalidate(clean(email));
  return { ok: true, message: "Queued email cancelled." };
}

export async function retryFailedEmail(id: string, email: string): Promise<ActionResult> {
  const session = await requireAdmin();
  const db = adminDb();
  const { error: resetError } = await db
    .from("email_outbox")
    .update({ status: "queued", error: null })
    .eq("id", id)
    .eq("status", "failed");
  if (resetError) return { ok: false, message: resetError.message };

  await sendImmediately(id).catch(() => {});
  const { data } = await db.from("email_outbox").select("status, error").eq("id", id).maybeSingle();
  const row = data as { status: string; error: string | null } | null;

  await logAudit({
    actor: session.email,
    action: "email.retry",
    entityType: "email_outbox",
    entityId: id,
    diff: { result: row?.status ?? "unknown" },
  });
  revalidate(clean(email));
  return row?.status === "sent"
    ? { ok: true, message: "Sent." }
    : { ok: false, message: row?.error ?? "Retry failed — still queued." };
}

/* ---------------- marketing suppression ------------------------------------ */

export async function suppressMarketing(email: string): Promise<ActionResult> {
  const session = await requireAdmin();
  const to = clean(email);
  const db = adminDb();
  const now = new Date().toISOString();

  // Suppression is per-email, not per-subscription row: mark every existing row
  // and leave a marker row when they were never a subscriber, so the batch-wise
  // suppression check in the sweeps sees them either way.
  const { data: rows } = await db.from("subscribers").select("id").eq("email", to);
  if ((rows ?? []).length) {
    await db.from("subscribers").update({ unsubscribed_at: now }).eq("email", to);
  } else {
    await db
      .from("subscribers")
      .upsert({ email: to, source: "admin", unsubscribed_at: now }, { onConflict: "email,source" });
  }

  await logAudit({
    actor: session.email,
    action: "marketing.suppress",
    entityType: "customer",
    entityId: to,
  });
  revalidate(to);
  return { ok: true, message: "Marketing suppressed. Transactional email still sends." };
}

export async function resubscribeMarketing(email: string): Promise<ActionResult> {
  const session = await requireAdmin();
  const to = clean(email);
  const { error } = await adminDb()
    .from("subscribers")
    .update({ unsubscribed_at: null })
    .eq("email", to);
  if (error) return { ok: false, message: error.message };

  await logAudit({
    actor: session.email,
    action: "marketing.resubscribe",
    entityType: "customer",
    entityId: to,
  });
  revalidate(to);
  return { ok: true, message: "Marketing re-enabled." };
}

/* ---------------- notes + tags --------------------------------------------- */

export async function addNote(email: string, note: string): Promise<ActionResult> {
  const session = await requireAdmin();
  const body = note.trim();
  if (!body) return { ok: false, message: "Note is empty." };
  const to = clean(email);

  const { error } = await adminDb()
    .from("customer_notes")
    .insert({ email: to, note: body, actor_email: session.email });
  if (error) return { ok: false, message: error.message };

  revalidate(to);
  return { ok: true, message: "Note added." };
}

export async function setTags(email: string, tags: string[]): Promise<ActionResult> {
  const session = await requireAdmin();
  const to = clean(email);
  const cleanTags = [...new Set(tags.map((t) => t.trim()).filter(Boolean))].slice(0, 12);

  const { error } = await adminDb()
    .from("customer_profiles")
    .upsert(
      { email: to, tags: cleanTags, updated_at: new Date().toISOString() },
      { onConflict: "email" },
    );
  if (error) return { ok: false, message: error.message };

  await logAudit({
    actor: session.email,
    action: "customer.tags",
    entityType: "customer",
    entityId: to,
    diff: { tags: cleanTags },
  });
  revalidate(to);
  return { ok: true, message: "Tags updated." };
}

/* ---------------- internals ------------------------------------------------ */

async function findStage(email: string, sequence: SequenceId, stage: number) {
  const person = await loadPerson(email);
  const states = await deriveSequenceState(person);
  const state = states.find((s) => s.id === sequence);
  if (!state) return null;
  const derived = state.stages.find((s) => s.stage === stage);
  // Only touches that haven't happened yet can be skipped or pulled forward.
  if (!derived || (derived.state !== "next" && derived.state !== "pending")) return null;
  return { stage: derived, state, person };
}

type Person = Awaited<ReturnType<typeof loadPerson>>;
type State = Awaited<ReturnType<typeof deriveSequenceState>>[number];

/** Rebuild the payload a sweep would have sent for this stage. */
async function buildPayload(
  sequence: SequenceId,
  email: string,
  state: State,
  person: Person,
): Promise<Record<string, unknown> | null> {
  switch (sequence) {
    case "cart_recovery": {
      if (!person.cart) return null;
      return { cart: person.cart.cart, subtotal_cents: person.cart.subtotal_cents };
    }
    case "payment_reminders": {
      const order = person.orders.find((o) => o.id === state.orderId);
      if (!order) return null;
      const settings = await getSettings();
      const { data } = await adminDb()
        .from("orders")
        .select("payment_method, payment_reference")
        .eq("id", order.id)
        .maybeSingle();
      const pay = data as { payment_method: string | null; payment_reference: string | null } | null;
      const hoursLeft = order.payment_expires_at
        ? Math.max(
            0,
            Math.round((new Date(order.payment_expires_at).getTime() - Date.now()) / 3_600_000),
          )
        : settings.paymentExpiryHours;
      return {
        order_number: order.order_number,
        order_id: order.id,
        payment_method: pay?.payment_method ?? "bank_transfer",
        reference: pay?.payment_reference ?? referenceForOrderNumber(order.order_number),
        amount_cents: order.total_cents,
        hours_left: hoursLeft,
      };
    }
    case "post_purchase_review": {
      const order = person.orders.find((o) => o.id === state.orderId);
      if (!order) return null;
      const { data } = await adminDb()
        .from("order_items")
        .select("product_name")
        .eq("order_id", order.id);
      const products = [
        ...new Set(((data ?? []) as { product_name: string }[]).map((i) => i.product_name)),
      ];
      return {
        order_number: order.order_number,
        products,
        review_url: `https://eastcoastlabs.com.au/leave-a-review?order=${encodeURIComponent(
          order.order_number,
        )}&email=${encodeURIComponent(email)}`,
      };
    }
    case "review_thank_you": {
      const review = person.reviews[0];
      return review ? { rating: review.rating } : null;
    }
    case "replenishment": {
      const order = person.orders.find((o) => o.id === state.orderId);
      if (!order) return null;
      const { data } = await adminDb()
        .from("order_items")
        .select("product_name, qty, variant_label, product_variants(pack_size)")
        .eq("order_id", order.id);
      const items = (data ?? []) as unknown as {
        product_name: string;
        qty: number;
        variant_label: string;
        product_variants: { pack_size: number } | null;
      }[];
      const packSize = Math.max(1, ...items.map((i) => i.product_variants?.pack_size ?? 1));
      return { pack_size: packSize, items: items.map((i) => ({ name: i.product_name, qty: i.qty })) };
    }
    // Welcome, winback and the second-purchase nudge render entirely from the
    // template's own copy — no per-recipient data beyond the unsubscribe link.
    default:
      return {};
  }
}
