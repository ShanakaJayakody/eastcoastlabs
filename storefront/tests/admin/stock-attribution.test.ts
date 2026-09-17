import { expect, it } from "vitest";
import { allocateStockByPerson, UNASSIGNED_STOCK, type AttributionMovement, type AttributionProduct } from "@/lib/admin/stock-attribution";

const admins = [
  { id: "alex", email: "alex@example.test", name: "Alex Chen", active: true },
  { id: "jordan", email: "jordan@example.test", name: "Jordan Lee", active: true },
  { id: "operator", email: "operator@example.test", name: "Taylor Singh", active: true },
];
const products: AttributionProduct[] = [
  { id: "small", name: "Sample", slug: "sample", size_label: "10 mg", size_parent_id: null, product_variants: [{ id: "pool", pack_size: 1 }] },
  { id: "large", name: "Sample", slug: "sample-large", size_label: "20 mg", size_parent_id: "small", product_variants: [{ id: "large-pool", pack_size: 1 }, { id: "legacy-pack", pack_size: 3 }] },
];
const move = (sequence: number, qty: number, reason: string, actor = "operator", extra: Partial<AttributionMovement> = {}): AttributionMovement => ({
  id: `m${sequence}`, ledger_sequence: sequence, qty, reason, actor_email: `${actor}@example.test`, variant_id: "pool", order_id: null,
  reverses_receipt_id: null, created_at: "2026-09-17T01:00:00Z", ...extra,
});
const report = (rows: AttributionMovement[]) => allocateStockByPerson(rows, products, admins, "2026-09-17T02:00:00Z");
const person = (rows: AttributionMovement[], id: string) => report(rows).people.find(row => row.id === id);

it("splits a sale across the original suppliers, not the admin processing payment", () => {
  const rows = [move(1, 10, "received", "alex"), move(2, 20, "received", "jordan"), move(3, -15, "sale", "operator", { order_id: "order" })];
  expect(person(rows, "alex")).toMatchObject({ supplied: 10, sold: 10, remaining: 0 });
  expect(person(rows, "jordan")).toMatchObject({ supplied: 20, sold: 5, remaining: 15 });
  expect(person(rows, "operator")).toMatchObject({ supplied: 0, sold: 0 });
  expect(report(rows).rows.find(row => row.personId === "jordan")?.sales).toEqual([expect.objectContaining({ orderId: "order", quantity: 5 })]);
});

it("returns units to the original order's supplier allocation rather than the return operator", () => {
  const rows = [move(1, 10, "received", "alex"), move(2, 20, "received", "jordan"), move(3, -15, "sale", "operator", { order_id: "order" }), move(4, 7, "return", "operator", { order_id: "order" })];
  expect(person(rows, "jordan")).toMatchObject({ sold: 0, returned: 5, remaining: 20 });
  expect(person(rows, "alex")).toMatchObject({ sold: 8, returned: 2, remaining: 2 });
  expect(report(rows).totals).toMatchObject({ supplied: 30, sold: 8, returned: 7, remaining: 22 });
});

it("preserves returned stock's original FIFO priority when it is sold again", () => {
  const rows = [move(1, 4, "received", "alex"), move(2, 4, "received", "jordan"), move(3, -4, "sale", "operator", { order_id: "first" }), move(4, 2, "return", "operator", { order_id: "first" }), move(5, -3, "sale", "operator", { order_id: "second" })];
  expect(person(rows, "alex")).toMatchObject({ sold: 4, remaining: 0 });
  expect(person(rows, "jordan")).toMatchObject({ sold: 1, remaining: 3 });
});

it("keeps sizes separate and converts historical pack movements into physical vials", () => {
  const rows = [move(1, 10, "received", "alex"), move(2, 2, "received", "jordan", { variant_id: "legacy-pack" }), move(3, -1, "sale", "operator", { variant_id: "legacy-pack" })];
  expect(person(rows, "alex")).toMatchObject({ sold: 0, remaining: 10 });
  expect(person(rows, "jordan")).toMatchObject({ supplied: 6, sold: 3, remaining: 3 });
  expect(report(rows).rows.find(row => row.personId === "jordan")).toMatchObject({ sizeLabel: "20 mg", productHref: "/admin/products/sample#sizes" });
});

it("records damage as other changes, not sales, and does not call a positive recount a supply", () => {
  const rows = [move(1, 10, "received", "alex"), move(2, -3, "adjustment"), move(3, 5, "recount", "jordan"), move(4, -9, "sale")];
  expect(person(rows, "alex")).toMatchObject({ supplied: 10, sold: 7, adjusted: -3, remaining: 0 });
  expect(person(rows, "jordan")).toMatchObject({ supplied: 0, sold: 0 });
  expect(person(rows, UNASSIGNED_STOCK)).toMatchObject({ supplied: 0, sold: 2, adjusted: 5, remaining: 3 });
});

it("removes a reversed receipt from that supplier without consuming someone else's earlier stock", () => {
  const rows = [move(1, 10, "received", "alex"), move(2, 20, "received", "jordan"), move(3, -20, "recount", "operator", { reverses_receipt_id: "m2" })];
  expect(person(rows, "alex")).toMatchObject({ supplied: 10, remaining: 10 });
  expect(person(rows, "jordan")).toMatchObject({ supplied: 0, remaining: 0 });
});

it("retains unattributed legacy stock instead of assigning it to the next known supplier", () => {
  const rows = [move(1, 8, "received", "system", { actor_email: null }), move(2, 10, "received", "alex"), move(3, -12, "sale")];
  expect(person(rows, UNASSIGNED_STOCK)).toMatchObject({ supplied: 8, sold: 8, remaining: 0 });
  expect(person(rows, "alex")).toMatchObject({ supplied: 10, sold: 4, remaining: 6 });
});

it("flags a sale without opening stock rather than borrowing from a later supplier", () => {
  const rows = [move(1, -5, "sale"), move(2, 10, "received", "alex")];
  expect(person(rows, "alex")).toMatchObject({ sold: 0, remaining: 10 });
  expect(person(rows, UNASSIGNED_STOCK)).toMatchObject({ sold: 5, remaining: -5 });
  expect(report(rows)).toMatchObject({ unresolvedVials: 5, totals: { remaining: 5 } });
});

it("keeps unmatched returns explicit instead of making a named supplier's sales negative", () => {
  const rows = [move(1, 4, "received", "alex"), move(2, -2, "sale", "operator", { order_id: "one" }), move(3, 3, "return", "jordan", { order_id: "other" })];
  expect(person(rows, "alex")).toMatchObject({ sold: 2, remaining: 2 });
  expect(person(rows, UNASSIGNED_STOCK)).toMatchObject({ adjusted: 3, remaining: 3 });
  expect(report(rows).unlinkedReturnVials).toBe(3);
});

it("orders by receipt time with a stable sequence tie-breaker and leaves source data unchanged", () => {
  const rows = [move(2, 10, "received", "jordan"), move(1, 10, "received", "alex"), move(3, -12, "sale")];
  expect(person(rows, "alex")).toMatchObject({ sold: 10 });
  expect(rows.map(row => row.id)).toEqual(["m2", "m1", "m3"]);
  expect(() => report([rows[0], rows[0]])).toThrow(/duplicate/);
});

it("reconciles every person's balance and the full ledger through repeated sales, corrections and returns", () => {
  const rows: AttributionMovement[] = [];
  for (let i = 1; i <= 30; i++) {
    rows.push(move(i * 4, 8, "received", i % 2 ? "alex" : "jordan"));
    rows.push(move(i * 4 + 1, -5, "sale", "operator", { order_id: `order-${i}` }));
    rows.push(move(i * 4 + 2, -1, "adjustment"));
    rows.push(move(i * 4 + 3, 2, "return", "operator", { order_id: `order-${i}` }));
  }
  const result = report(rows);
  expect(result.totals.remaining).toBe(rows.reduce((sum, row) => sum + row.qty, 0));
  for (const row of result.rows) expect(row.remaining).toBe(row.supplied - row.sold + row.adjusted);
  expect(result.rows.every(row => row.sales.length <= 10)).toBe(true);
});
