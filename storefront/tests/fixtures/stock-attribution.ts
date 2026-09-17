import { allocateStockByPerson, type AttributionMovement, type AttributionProduct } from "@/lib/admin/stock-attribution";

const products: AttributionProduct[] = [
  { id: "reta10", name: "Retatrutide", slug: "retatrutide", size_label: "10 mg", size_parent_id: null, product_variants: [{ id: "r10", pack_size: 1 }] },
  { id: "reta20", name: "Retatrutide", slug: "retatrutide-20", size_label: "20 mg", size_parent_id: "reta10", product_variants: [{ id: "r20", pack_size: 1 }] },
  { id: "bpc", name: "BPC-157", slug: "bpc-157", size_label: "10 mg", size_parent_id: null, product_variants: [{ id: "b10", pack_size: 1 }] },
];
const admins = [
  { id: "alex", email: "alex@example.test", name: "Alex Chen", active: true },
  { id: "jordan", email: "jordan@example.test", name: "Jordan Lee", active: true },
  { id: "taylor", email: "taylor@example.test", name: "Taylor Singh", active: true },
];
const movement = (id: number, pool: string, qty: number, reason: string, actor: string, order: string | null = null): AttributionMovement => ({
  id: `movement-${id}`, ledger_sequence: id, variant_id: pool, qty, reason, actor_email: `${actor}@example.test`, order_id: order,
  reverses_receipt_id: null, created_at: `2026-09-${String(id + 5).padStart(2, "0")}T01:30:00Z`,
});
export function stockAttributionFixture() {
  const report = allocateStockByPerson([
    movement(1, "r10", 80, "received", "alex"), movement(2, "r10", 40, "received", "jordan"), movement(3, "r20", 30, "received", "taylor"),
    movement(4, "b10", 60, "received", "alex"), movement(5, "b10", 50, "received", "jordan"),
    movement(6, "r10", -95, "sale", "taylor", "4001"), movement(7, "b10", -35, "sale", "taylor", "4002"), movement(8, "r20", -12, "sale", "alex", "4003"),
    movement(9, "r10", 5, "return", "taylor", "4001"), movement(10, "b10", -3, "adjustment", "taylor"), movement(11, "b10", -30, "sale", "taylor", "4004"),
    movement(12, "r20", 10, "recount", "alex"),
  ], products, admins, "2026-09-17T02:00:00Z");
  for (const row of report.rows) for (const sale of row.sales) sale.orderNumber = sale.orderId ? `ECL-${sale.orderId}` : null;
  return report;
}
