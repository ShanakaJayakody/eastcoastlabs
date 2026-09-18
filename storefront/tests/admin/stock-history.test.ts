import { beforeEach, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  movements: [
    { id: "receipt", qty: 12, reason: "received", actor_email: "named@example.test", note: "Delivery", created_at: "2026-09-17T02:00:00Z" },
    { id: "sale", qty: -1, reason: "sale", actor_email: null, note: null, created_at: "2026-09-17T01:00:00Z" },
    { id: "unnamed", qty: 4, reason: "received", actor_email: "unnamed@example.test", note: null, created_at: "2026-09-16T01:00:00Z" },
  ],
  error: null as { message: string } | null,
}));

vi.mock("@/lib/admin/db", () => ({ adminDb: () => ({
  from: (table: string) => ({ select: (fields: string) => {
    if (table === "admin_users") return { in: async () => ({ data: [{ email: "named@example.test", name: "  Alex Chen  " }], error: null }) };
    if (fields === "reverses_receipt_id") return { in: async () => ({ data: [{ reverses_receipt_id: "receipt" }], error: null }) };
    let reason: string | undefined;
    const query = {
      eq: (key: string, value: string) => { if (key === "reason") reason = value; return query; },
      order: () => query,
      limit: async (limit: number) => ({ data: fixture.movements.filter(row => !reason || row.reason === reason).slice(0, limit), error: fixture.error }),
    };
    return query;
  } }),
}) }));

import { variantMovements } from "@/lib/admin/products";
beforeEach(() => { fixture.error = null; });

it("resolves receipt names and reversals while keeping sales out of the receipt view", async () => {
  const receipts = await variantMovements("pool", 20, true);
  expect(receipts.map(row => ({ id: row.id, name: row.actor_name, reversed: row.reversed }))).toEqual([
    { id: "receipt", name: "Alex Chen", reversed: true },
    { id: "unnamed", name: null, reversed: false },
  ]);
});

it("keeps unattributed system movements in the complete history without inventing a name", async () => {
  const rows = await variantMovements("pool");
  expect(rows.find(row => row.id === "sale")).toMatchObject({ actor_name: null, actor_email: null, qty: -1 });
});

it("reports a failed history read instead of showing an empty ledger", async () => {
  fixture.error = { message: "offline" };
  await expect(variantMovements("pool")).rejects.toThrow("Cannot load stock history: offline");
});
