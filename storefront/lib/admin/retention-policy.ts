import 'server-only';
import { createHmac } from 'node:crypto';
import type { EmailTemplate } from './email';
/** Explicit operator timing, never inferred from a purchased quantity. */
export function reorderReminderDays(): number | null {
    const value = process.env.REORDER_REMINDER_DAYS ?? '';
    if (!/^[1-9][0-9]*$/.test(value))
        return null;
    const days = Number(value);
    return days <= 365 ? days : null;
}
export const RETENTION_TEMPLATES: readonly EmailTemplate[] = ['replenishment', 'winback_60', 'winback_90', 'second_purchase_nudge'];
export interface RetentionAssignment {
    id: string;
    arm: 'holdout' | 'treatment';
    bucket: number;
    percent: number;
}
/** Same normalized customer stays in one arm across optional purchase nudges.
 * Only opaque assignment metadata is stored; the HMAC key never leaves the server. */
export function retentionAssignment(email: string, template: EmailTemplate): RetentionAssignment | null {
    if (!RETENTION_TEMPLATES.includes(template))
        return null;
    const raw = process.env.RETENTION_HOLDOUT_PERCENT ?? '0';
    if (raw === '' || raw === '0')
        return null;
    const percent = Number(raw), key = process.env.RETENTION_HOLDOUT_KEY ?? '', id = process.env.RETENTION_EXPERIMENT_ID ?? '';
    if (!/^\d+$/.test(raw) || percent < 1 || percent > 100 || key.length < 24 || !/^[-a-zA-Z0-9_]{1,80}$/.test(id))
        throw new Error('Invalid retention holdout configuration');
    const digest = createHmac('sha256', key).update(`${id}\n${email.trim().toLowerCase()}`).digest();
    const bucket = digest.readUInt32BE(0) % 10000;
    return { id, arm: bucket < percent * 100 ? 'holdout' : 'treatment', bucket, percent };
}
