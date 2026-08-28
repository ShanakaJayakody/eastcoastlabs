import "server-only";

/**
 * Operator pauses, as consulted by the sweeps.
 *
 * A pause is not a state machine — it is one extra question each sweep asks
 * before queuing: "has someone told me to leave this person alone for this
 * sequence?" Everything else about the sweep stays a pure function of source-row
 * age, which is what keeps the sweeps idempotent and re-runnable.
 *
 * Consequence worth stating plainly (the UI does): windows keep aging while
 * paused. A touch whose window closes during a pause is missed, not replayed on
 * resume. Replaying would mean queuing a "you left this in your cart" email
 * about a cart abandoned a week ago.
 */
import { adminDb } from "./db";
import type { SequenceId } from "./sequences";

/** Emails currently paused for one sequence. */
export async function pausedEmailsFor(sequence: SequenceId): Promise<Set<string>> {
  const { data } = await adminDb()
    .from("sequence_overrides")
    .select("email")
    .eq("sequence", sequence)
    .eq("action", "pause");
  return new Set((data ?? []).map((r) => (r as { email: string }).email));
}

/**
 * PostgREST `in` list for a set of emails, or null when the set is empty.
 * Values are double-quoted so an address containing a comma can't split the
 * filter into two — the difference between "skip this person" and a malformed
 * query that skips nobody.
 */
export function inList(emails: Set<string> | string[]): string | null {
  const values = [...emails];
  if (!values.length) return null;
  return `(${values.map((e) => `"${e.replace(/"/g, '""')}"`).join(",")})`;
}

/** All pauses, for the "paused sequences" admin view. */
export async function listPauses(): Promise<
  { email: string; sequence: string; actor_email: string; reason: string | null; created_at: string }[]
> {
  const { data } = await adminDb()
    .from("sequence_overrides")
    .select("email, sequence, actor_email, reason, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  return (data ?? []) as {
    email: string;
    sequence: string;
    actor_email: string;
    reason: string | null;
    created_at: string;
  }[];
}
