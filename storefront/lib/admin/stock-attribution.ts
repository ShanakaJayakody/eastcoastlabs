/** Read-only FIFO allocation. These are accounting estimates, not physical lot evidence. */
export interface AttributionMovement {
  id: string;
  variant_id: string;
  qty: number;
  reason: string;
  actor_email: string | null;
  order_id: string | null;
  reverses_receipt_id: string | null;
  created_at: string;
  ledger_sequence: number;
}

export interface AttributionAdmin { id: string; email: string; name: string | null; active: boolean }
export interface AttributionProduct {
  id: string; name: string; slug: string; size_label: string | null; size_parent_id: string | null;
  categories?: string[] | null;
  product_variants: { id: string; pack_size: number }[];
}
export interface StockTotals { supplied: number; sold: number; returned: number; adjusted: number; remaining: number }
export interface AttributedSale {
  movementId: string; orderId: string | null; orderNumber: string | null; createdAt: string; quantity: number; returned: number;
}
export interface AttributedStockRow extends StockTotals {
  id: string; personId: string; personName: string; productId: string; productName: string; sizeLabel: string | null;
  productHref: string; sales: AttributedSale[]; saleCount: number;
}
export interface StockPerson extends StockTotals { id: string; name: string; nameMissing: boolean; active: boolean; productCount: number }
export interface StockAttribution {
  people: StockPerson[]; rows: AttributedStockRow[]; totals: StockTotals; asOf: string;
  unresolvedVials: number; unlinkedReturnVials: number;
}

export const UNASSIGNED_STOCK = "unassigned";
const zero = (): StockTotals => ({ supplied: 0, sold: 0, returned: 0, adjusted: 0, remaining: 0 });
const keys = ["supplied", "sold", "returned", "adjusted", "remaining"] as const;
const add = (target: StockTotals, source: StockTotals) => { for (const key of keys) target[key] += source[key]; };

interface Layer { receiptId: string | null; row: AttributedStockRow; remaining: number }
interface Consumption { layer: Layer; outstanding: number; sale: AttributedSale }

export function allocateStockByPerson(movements: AttributionMovement[], products: AttributionProduct[], admins: AttributionAdmin[], asOf: string): StockAttribution {
  const directory = new Map(admins.map(admin => [admin.email.trim().toLowerCase(), admin]));
  const people = new Map<string, StockPerson>();
  for (const admin of admins.filter(admin => admin.active)) {
    people.set(admin.id, { id: admin.id, name: admin.name?.trim() || "Name not set", nameMissing: !admin.name?.trim(), active: true, productCount: 0, ...zero() });
  }
  const byProduct = new Map(products.map(product => [product.id, product]));
  const variants = new Map(products.flatMap(product => product.product_variants.map(variant => [variant.id, { product, packSize: variant.pack_size }] as const)));
  const rows = new Map<string, AttributedStockRow>();
  const pools = new Map<string, Layer[]>();
  const poolHeads = new Map<string, number>();
  const receipts = new Map<string, Layer>();
  const orderConsumption = new Map<string, Consumption[]>();
  let unresolvedVials = 0;
  let unlinkedReturnVials = 0;

  function rowFor(variantId: string, email: string | null): AttributedStockRow {
    const variant = variants.get(variantId);
    if (!variant) throw new Error("Stock attribution is missing a product or vial size.");
    const admin = email ? directory.get(email.trim().toLowerCase()) : undefined;
    const personId = admin?.id ?? UNASSIGNED_STOCK;
    if (!people.has(personId)) people.set(personId, {
      id: personId, name: admin ? admin.name?.trim() || "Name not set" : "Unassigned / legacy",
      nameMissing: Boolean(admin && !admin.name?.trim()), active: admin?.active ?? false, productCount: 0, ...zero(),
    });
    const product = variant.product;
    const id = `${personId}:${product.id}`;
    if (!rows.has(id)) rows.set(id, {
      id, personId, personName: people.get(personId)!.name, productId: product.id, productName: product.name, sizeLabel: product.size_label,
      productHref: `/admin/products/${encodeURIComponent(byProduct.get(product.size_parent_id ?? "")?.slug ?? product.slug)}${product.size_parent_id ? "#sizes" : "#inventory"}`,
      sales: [], saleCount: 0, ...zero(),
    });
    return rows.get(id)!;
  }

  const seen = new Set<string>();
  const ordered = movements.slice().sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || a.ledger_sequence - b.ledger_sequence);
  for (const movement of ordered) {
    const packSize = variants.get(movement.variant_id)?.packSize;
    if (!packSize || !Number.isSafeInteger(packSize) || packSize < 1) throw new Error("Stock attribution is missing a valid vial size.");
    const qty = movement.qty * packSize;
    if (!Number.isSafeInteger(qty) || !Number.isFinite(Date.parse(movement.created_at)) || !Number.isSafeInteger(movement.ledger_sequence) || seen.has(movement.id)) {
      throw new Error("Stock history contains an invalid or duplicate movement.");
    }
    seen.add(movement.id);
    if (!qty) continue;
    const pool = pools.get(movement.variant_id) ?? [];
    pools.set(movement.variant_id, pool);
    const orderKey = movement.order_id ? `${movement.order_id}:${movement.variant_id}` : null;

    if (movement.reverses_receipt_id && qty < 0) {
      const layer = receipts.get(movement.reverses_receipt_id);
      const reversed = layer && pool.includes(layer) ? Math.min(-qty, layer.remaining) : 0;
      if (layer && reversed) {
        layer.remaining -= reversed;
        layer.row.supplied -= reversed;
        layer.row.remaining -= reversed;
      }
      if (reversed < -qty) {
        const row = rowFor(movement.variant_id, null);
        row.adjusted += qty + reversed;
        row.remaining += qty + reversed;
        unresolvedVials += -qty - reversed;
      }
      continue;
    }

    if (qty > 0 && movement.reason === "return") {
      let remaining = qty;
      const consumed = orderKey ? orderConsumption.get(orderKey) ?? [] : [];
      // Reverse the latest allocation within the same order and stock pool.
      for (let i = consumed.length - 1; i >= 0 && remaining; i--) {
        const part = consumed[i];
        const restored = Math.min(remaining, part.outstanding);
        if (!restored) continue;
        part.outstanding -= restored;
        part.sale.returned += restored;
        part.layer.remaining += restored;
        poolHeads.set(movement.variant_id, Math.min(poolHeads.get(movement.variant_id) ?? 0, pool.indexOf(part.layer)));
        part.layer.row.sold -= restored;
        part.layer.row.returned += restored;
        part.layer.row.remaining += restored;
        remaining -= restored;
      }
      if (remaining) {
        const row = rowFor(movement.variant_id, null);
        row.adjusted += remaining;
        row.remaining += remaining;
        pool.push({ receiptId: null, row, remaining });
        unlinkedReturnVials += remaining;
      }
      continue;
    }

    if (qty > 0) {
      const isReceipt = movement.reason === "received";
      // A recount adds existing stock; its operator is not evidence of a supplier.
      const row = rowFor(movement.variant_id, isReceipt ? movement.actor_email : null);
      row[isReceipt ? "supplied" : "adjusted"] += qty;
      row.remaining += qty;
      const layer: Layer = { receiptId: isReceipt ? movement.id : null, row, remaining: qty };
      pool.push(layer);
      if (isReceipt) receipts.set(movement.id, layer);
      continue;
    }

    let remaining = -qty;
    const isSale = movement.reason === "sale";
    const saleByRow = new Map<string, AttributedSale>();
    function consume(layer: Layer, units: number) {
      layer.remaining -= units;
      layer.row.remaining -= units;
      if (!isSale) { layer.row.adjusted -= units; return; }
      layer.row.sold += units;
      let sale = saleByRow.get(layer.row.id);
      if (!sale) {
        sale = { movementId: movement.id, orderId: movement.order_id, orderNumber: null, createdAt: movement.created_at, quantity: 0, returned: 0 };
        saleByRow.set(layer.row.id, sale);
        layer.row.sales.push(sale);
      }
      sale.quantity += units;
      if (orderKey) {
        const consumed = orderConsumption.get(orderKey) ?? [];
        consumed.push({ layer, outstanding: units, sale });
        orderConsumption.set(orderKey, consumed);
      }
    }
    for (let index = poolHeads.get(movement.variant_id) ?? 0; index < pool.length; index++) {
      const layer = pool[index];
      const units = Math.min(remaining, Math.max(0, layer.remaining));
      if (units) { consume(layer, units); remaining -= units; }
      if (layer.remaining <= 0) poolHeads.set(movement.variant_id, index + 1);
      if (!remaining) break;
    }
    if (remaining) {
      // Keep an explicit unassigned deficit; never credit a later supplier for an earlier sale.
      const layer: Layer = { receiptId: null, row: rowFor(movement.variant_id, null), remaining: 0 };
      pool.push(layer);
      consume(layer, remaining);
      unresolvedVials += remaining;
    }
  }

  const totals = zero();
  const resultRows = [...rows.values()].filter(row => keys.some(key => row[key] !== 0) || row.sales.length);
  for (const row of resultRows) {
    if (row.supplied - row.sold + row.adjusted !== row.remaining) throw new Error("Stock attribution does not reconcile.");
    add(totals, row);
    const person = people.get(row.personId)!;
    add(person, row);
    person.productCount++;
    // Entries were appended in timestamp/ledger order; reversing preserves the sequence tie-breaker.
    row.sales.reverse();
    row.saleCount = row.sales.length;
    row.sales = row.sales.slice(0, 10);
  }
  const resultPeople = [...people.values()].filter(person => person.active || person.productCount).sort((a, b) =>
    Number(a.id === UNASSIGNED_STOCK) - Number(b.id === UNASSIGNED_STOCK) || b.supplied - a.supplied || a.name.localeCompare(b.name));
  resultRows.sort((a, b) => a.personName.localeCompare(b.personName) || a.productName.localeCompare(b.productName) || (a.sizeLabel ?? "").localeCompare(b.sizeLabel ?? ""));
  return { people: resultPeople, rows: resultRows, totals, asOf, unresolvedVials, unlinkedReturnVials };
}
