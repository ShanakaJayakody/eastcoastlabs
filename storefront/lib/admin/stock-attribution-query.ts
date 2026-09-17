import "server-only";
import { cache } from "react";
import { requireAdmin } from "./auth";
import { adminDb } from "./db";
import { fetchAll } from "./paging";
import { allocateStockByPerson, type AttributionAdmin, type AttributionMovement, type AttributionProduct, type StockAttribution } from "./stock-attribution";

export const getStockAttribution = cache(async (): Promise<StockAttribution> => {
  await requireAdmin();
  const db = adminDb();
  const asOf = new Date().toISOString();
  const [snapshot, products, admins] = await Promise.all([
    db.from("stock_movements").select("ledger_sequence").order("ledger_sequence", { ascending: false }).limit(1).maybeSingle(),
    fetchAll<AttributionProduct>((from, to) => db.from("products")
      .select("id, name, slug, categories, size_label, size_parent_id, product_variants(id, pack_size)").order("id").range(from, to), "Stock products"),
    fetchAll<AttributionAdmin>((from, to) => db.from("admin_users").select("id, email, name, active").order("id").range(from, to), "Stock admin names"),
  ]);
  if (snapshot.error) throw new Error(`Cannot read stock history: ${snapshot.error.message}`);
  // Bound pagination to one ledger high-water mark so later appends cannot shift its pages.
  const highWater = snapshot.data?.ledger_sequence;
  const movements = highWater == null ? [] : await fetchAll<AttributionMovement>((from, to) => db.from("stock_movements")
    .select("id, variant_id, qty, reason, actor_email, order_id, reverses_receipt_id, created_at, ledger_sequence")
    .lte("ledger_sequence", highWater).order("created_at").order("ledger_sequence").range(from, to), "Stock attribution history");
  // A swab pack, syringe box or kit is an inventory unit, not a vial.
  const accessoryVariants = new Set(products.filter(product => product.categories?.some(category => category.toLowerCase() === "accessory"))
    .flatMap(product => product.product_variants.map(variant => variant.id)));
  const report = allocateStockByPerson(movements.filter(movement => !accessoryVariants.has(movement.variant_id)), products, admins, asOf);

  const ids = [...new Set(report.rows.flatMap(row => row.sales.flatMap(sale => sale.orderId ? [sale.orderId] : [])))];
  const orderNumbers = new Map<string, string>();
  for (let offset = 0; offset < ids.length; offset += 200) {
    const { data, error } = await db.from("orders").select("id, order_number").in("id", ids.slice(offset, offset + 200));
    if (error) throw new Error(`Cannot read stock sale orders: ${error.message}`);
    for (const order of data ?? []) orderNumbers.set(order.id, order.order_number);
  }
  for (const row of report.rows) for (const sale of row.sales) sale.orderNumber = orderNumbers.get(sale.orderId ?? "") ?? null;
  return report;
});
