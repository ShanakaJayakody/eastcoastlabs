/**
 * The one place sequence timing is defined.
 *
 * Every automated follow-up in this system is a deterministic function of its
 * source row's age: a stage is due when that age enters the stage's window and
 * the outbox has no row for it yet. That property is what lets the admin PREDICT
 * the next touch instead of merely logging past ones — but only if the sweeps
 * and the UI agree on the numbers. They agree because both import from here.
 *
 * Windows are half-open [from, until) in HOURS since the anchor, even for the
 * lifecycle sequences that read more naturally in days. One unit means one
 * prediction function instead of five.
 *
 * The related-id builders live here too, and matter more than they look: the
 * outbox's (to_email, template, related_id) unique index is the send-exactly-once
 * guarantee, so an admin "send now" that reuses the sweep's own id is idempotent
 * against the cron by construction — whichever fires first wins and the other
 * becomes a no-op. Divergent id schemes would silently double-send.
 */
import type { EmailTemplate } from "./email";

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;

export type SequenceId =
  | "cart_recovery"
  | "payment_reminders"
  | "welcome"
  | "post_purchase_review"
  | "replenishment"
  | "winback"
  | "second_purchase";

export interface StageSpec {
  /** Operator-facing name for this touch. */
  label: string;
  template: EmailTemplate;
  /** Hours since the anchor at which this touch becomes due. */
  from: number;
  /** Hours since the anchor after which this touch is no longer eligible. */
  until: number;
}

export interface SequenceSpec {
  id: SequenceId;
  label: string;
  /** Marketing sequences respect unsubscribe; transactional ones must always send. */
  marketing: boolean;
  stages: StageSpec[];
  /** What the anchor timestamp means, for the UI caption. */
  anchor: string;
}

/**
 * Cart recovery — three touches on DISJOINT idle windows, dead after a week.
 * Disjoint means a cart discovered late (first deploy, cron outage) gets the one
 * currently-due touch, never a burst of all three.
 */
export const CART_STAGES: StageSpec[] = [
  { label: "Touch 1", template: "abandoned_cart", from: 1, until: 24 },
  { label: "Touch 2", template: "abandoned_cart_2", from: 24, until: 72 },
  { label: "Touch 3", template: "abandoned_cart_3", from: 72, until: 168 },
];

/** Payment reminders — hours since order creation, bounded by the payment hold. */
export const PAYMENT_STAGES: StageSpec[] = [
  { label: "Reminder 1", template: "payment_reminder", from: 4, until: 24 },
  { label: "Reminder 2", template: "payment_reminder", from: 24, until: 24 * 14 },
];

/** Hours-since-creation at which each payment reminder is due (sweep contract). */
export const REMINDER_STAGES = PAYMENT_STAGES.map((s) => s.from) as readonly number[];

export const WELCOME_STAGES: StageSpec[] = [
  { label: "Welcome 1", template: "welcome_1", from: 0, until: 1 },
  { label: "Welcome 3", template: "welcome_3", from: 4 * 24, until: 18 * 24 },
];

export const REVIEW_STAGES: StageSpec[] = [
  { label: "Review request", template: "post_purchase_review", from: 14 * 24, until: 35 * 24 },
];

export const WINBACK_STAGES: StageSpec[] = [
  { label: "Winback 60d", template: "winback_60", from: 60 * 24, until: 90 * 24 },
  { label: "Winback 90d", template: "winback_90", from: 90 * 24, until: 150 * 24 },
];

export const SECOND_PURCHASE_STAGES: StageSpec[] = [
  { label: "Second-purchase nudge", template: "second_purchase_nudge", from: 30 * 24, until: 60 * 24 },
];

/** Replenishment fires once, on a threshold scaled by the order's largest pack. */
export const replenishmentStages = (packSize: number): StageSpec[] => {
  const days = replenishmentDays(packSize);
  return [
    {
      label: `Replenishment (${packSize}-pack)`,
      template: "replenishment",
      from: days * 24,
      until: (days + 42) * 24,
    },
  ];
};

export const replenishmentDays = (packSize: number): number =>
  packSize >= 6 ? 154 : packSize >= 3 ? 70 : 21;

export const SEQUENCE_LABELS: Record<SequenceId, string> = {
  cart_recovery: "Cart recovery",
  payment_reminders: "Payment reminders",
  welcome: "Welcome series",
  post_purchase_review: "Review request",
  replenishment: "Replenishment",
  winback: "Winback",
  second_purchase: "Second-purchase nudge",
};

/** Sequences an operator may pause. Payment reminders are transactional-ish but
 *  still pausable — an operator settling payment by phone shouldn't have the
 *  system nagging behind them. */
export const PAUSABLE: SequenceId[] = [
  "cart_recovery",
  "payment_reminders",
  "welcome",
  "post_purchase_review",
  "replenishment",
  "winback",
  "second_purchase",
];

/** Templates that must deliver regardless of marketing suppression. */
export const TRANSACTIONAL_TEMPLATES: EmailTemplate[] = [
  "order_confirmation",
  "order_shipped",
  "order_refunded",
  "payment_instructions",
  "payment_reminder",
  "payment_expired",
];

export const isTransactional = (template: EmailTemplate): boolean =>
  TRANSACTIONAL_TEMPLATES.includes(template);

/* ---------------- related-id builders (shared with the sweeps) ------------- */

export const cartRelatedId = (email: string, stage: number, capturedAtIso: string): string =>
  `${email}:cart:${stage}:${Date.parse(capturedAtIso)}`;

export const paymentReminderRelatedId = (orderId: string, stage: number): string =>
  `${orderId}:reminder:${stage}`;

export const welcomeRelatedId = (email: string, stage: number): string =>
  `${email}:welcome:${stage}`;

export const reviewRelatedId = (orderId: string): string => `${orderId}:pp:review`;

export const replenishmentRelatedId = (orderId: string): string => `${orderId}:replenishment`;

export const winbackRelatedId = (email: string, stage: 60 | 90, lastOrderAtIso: string): string =>
  `${email}:winback:${stage}:${lastOrderAtIso.slice(0, 10)}`;

export const secondPurchaseRelatedId = (email: string, lastOrderAtIso: string): string =>
  `${email}:nudge:30:${lastOrderAtIso.slice(0, 10)}`;

/* ---------------- stage-state derivation (shared by every surface) --------- */

export type StageState = "sent" | "next" | "pending" | "skipped" | "missed";

export interface DerivedStage {
  label: string;
  template: EmailTemplate;
  state: StageState;
  /** When it was sent/queued, if it was. */
  at: string | null;
  /** Milliseconds until due — only meaningful for `next`. */
  etaMs: number | null;
  outboxId: string | null;
  outboxStatus: string | null;
  relatedId: string;
  /** Stage index, 1-based — what "send stage N now" refers to. */
  stage: number;
}

export interface OutboxLookupRow {
  id: string;
  template: string;
  related_id: string | null;
  status: string;
  created_at: string;
  sent_at: string | null;
}

/**
 * Resolve every stage of one sequence against the outbox.
 *
 * A stage is `sent` when an outbox row exists for its related id, `skipped` when
 * that row was cancelled, `missed` when its window closed with nothing sent,
 * `next` for the earliest still-eligible unsent stage, and `pending` for the
 * ones behind it. Nothing here reads a status column on the source row — the
 * outbox IS the record of what happened, which is why this stays correct even
 * after a cart re-capture resets `reminder_stage`.
 */
export function deriveStages(
  stages: StageSpec[],
  anchorIso: string | null,
  relatedIdFor: (stageIndex1Based: number) => string,
  outbox: OutboxLookupRow[],
  now = Date.now(),
): DerivedStage[] {
  if (!anchorIso) return [];
  const anchor = new Date(anchorIso).getTime();
  if (!Number.isFinite(anchor)) return [];

  const byRelated = new Map<string, OutboxLookupRow>();
  for (const row of outbox) {
    if (row.related_id) byRelated.set(`${row.template}::${row.related_id}`, row);
  }

  const ageHours = (now - anchor) / HOUR;
  let nextClaimed = false;

  return stages.map((spec, i) => {
    const stage = i + 1;
    const relatedId = relatedIdFor(stage);
    const hit = byRelated.get(`${spec.template}::${relatedId}`);

    if (hit) {
      return {
        label: spec.label,
        template: spec.template,
        state: hit.status === "cancelled" ? "skipped" : "sent",
        at: hit.sent_at ?? hit.created_at,
        etaMs: null,
        outboxId: hit.id,
        outboxStatus: hit.status,
        relatedId,
        stage,
      };
    }

    // Window already closed with nothing sent — this touch will never fire.
    if (ageHours >= spec.until) {
      return {
        label: spec.label,
        template: spec.template,
        state: "missed",
        at: null,
        etaMs: null,
        outboxId: null,
        outboxStatus: null,
        relatedId,
        stage,
      };
    }

    const state: StageState = nextClaimed ? "pending" : "next";
    if (!nextClaimed) nextClaimed = true;

    return {
      label: spec.label,
      template: spec.template,
      state,
      at: null,
      // Already inside the window means it's due on the next cron tick.
      etaMs: Math.max(0, anchor + spec.from * HOUR - now),
      outboxId: null,
      outboxStatus: null,
      relatedId,
      stage,
    };
  });
}

/** Soonest upcoming touch across a set of derived stages, in ms. */
export function nextEta(stages: DerivedStage[]): number | null {
  const next = stages.find((s) => s.state === "next");
  return next ? next.etaMs : null;
}
