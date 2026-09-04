/**
 * Packing queue navigation.
 *
 * Packing is the one admin job done standing up with both hands busy, so it
 * gets its own screen: one order, a checklist, and a way to the next one
 * without going back to a table and finding your place again.
 */
import "server-only";
import { adminDb } from "./db";

const PACKABLE = ["paid", "processing"];

const QUEUE_LIMIT = 500;

export interface PackQueuePosition {
  /** Order ids still to pack, oldest paid first — the order you'd work through. */
  queue: string[];
  index: number;
  nextId: string | null;
  /** Packable orders in total, even when more exist than the queue window holds. */
  total: number;
  /** True when the backlog exceeds the window, so `index` cannot be trusted. */
  truncated: boolean;
}

/**
 * Where this order sits in the packing queue.
 *
 * Ordered by payment time so the person who has waited longest is packed first.
 * An order that is not packable (already shipped, or refunded mid-pack) still
 * resolves, with `index` -1, so the screen can say so rather than 404.
 */
export async function packQueuePosition(orderId: string): Promise<PackQueuePosition> {
  const db = adminDb();
  const [{ data, error }, { count }] = await Promise.all([
    db
      .from("orders")
      .select("id, paid_at")
      .in("status", PACKABLE)
      .order("paid_at", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true })
      .limit(QUEUE_LIMIT),
    db.from("orders").select("*", { count: "exact", head: true }).in("status", PACKABLE),
  ]);
  if (error) throw new Error(`packQueuePosition: ${error.message}`);

  const queue = (data ?? []).map((r) => r.id as string);
  const index = queue.indexOf(orderId);
  const total = count ?? queue.length;
  // A backlog deeper than the window means an absent id proves nothing about
  // whether the order is packable — the caller must not read index -1 as "done".
  const truncated = total > queue.length;

  return {
    queue,
    index,
    // The next one to pack after this. When the order is genuinely no longer in
    // the queue, the head is the right place to send the operator; when the
    // queue is merely truncated, sending them back to the head would be moving
    // them backwards, so offer nothing instead.
    nextId:
      index >= 0 ? (queue[index + 1] ?? null) : truncated ? null : (queue[0] ?? null),
    total,
    truncated,
  };
}
