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

export interface PackQueuePosition {
  /** Order ids still to pack, oldest paid first — the order you'd work through. */
  queue: string[];
  index: number;
  nextId: string | null;
  total: number;
}

/**
 * Where this order sits in the packing queue.
 *
 * Ordered by payment time so the person who has waited longest is packed first.
 * An order that is not packable (already shipped, or refunded mid-pack) still
 * resolves, with `index` -1, so the screen can say so rather than 404.
 */
export async function packQueuePosition(orderId: string): Promise<PackQueuePosition> {
  const { data, error } = await adminDb()
    .from("orders")
    .select("id, paid_at, created_at")
    .in("status", PACKABLE)
    .order("paid_at", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true })
    .limit(500);
  if (error) throw new Error(`packQueuePosition: ${error.message}`);

  const queue = (data ?? []).map((r) => r.id as string);
  const index = queue.indexOf(orderId);
  return {
    queue,
    index,
    // The next one to pack after this: the following entry, or the first if
    // this order is no longer in the queue (just shipped, most likely).
    nextId: index >= 0 ? (queue[index + 1] ?? null) : (queue[0] ?? null),
    total: queue.length,
  };
}
