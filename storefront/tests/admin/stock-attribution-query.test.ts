import { beforeEach, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({ tables: {} as Record<string, Record<string, unknown>[]>, errorTable: "", appendAfterSnapshot: false, auth: vi.fn() }));
vi.mock("@/lib/admin/auth", () => ({ requireAdmin: fixture.auth }));
vi.mock("@/lib/admin/db", () => ({ adminDb: () => ({ from: (table: string) => {
  let rows = [...fixture.tables[table] ?? []];
  const sorts: { key: string; ascending: boolean }[] = [];
  let limit = 500;
  function result(from = 0, to = limit - 1) {
    rows.sort((a, b) => { for (const sort of sorts) { const av = a[sort.key] as number | string, bv = b[sort.key] as number | string; if (av !== bv) return (av < bv ? -1 : 1) * (sort.ascending ? 1 : -1); } return 0; });
    return { data: rows.slice(from, to + 1), error: table === fixture.errorTable ? { message: "offline" } : null };
  }
  const query = {
    select: () => query,
    order: (key: string, opts?: { ascending?: boolean }) => { sorts.push({ key, ascending: opts?.ascending !== false }); return query; },
    limit: (value: number) => { limit = value; return query; },
    lte: (key: string, value: number) => { rows = rows.filter(row => Number(row[key]) <= value); return query; },
    in: (key: string, values: unknown[]) => { rows = rows.filter(row => values.includes(row[key])); return query; },
    range: async (from: number, to: number) => result(from, to),
    maybeSingle: async () => {
      const found = result();
      if (fixture.appendAfterSnapshot && table === "stock_movements") {
        fixture.tables.stock_movements.push({ ...fixture.tables.stock_movements[1], id: "future", ledger_sequence: 9999 });
        fixture.appendAfterSnapshot = false;
      }
      return { data: found.data[0] ?? null, error: found.error };
    },
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve),
  };
  return query;
} }) }));

import { getStockAttribution } from "@/lib/admin/stock-attribution-query";
beforeEach(() => {
  vi.clearAllMocks(); fixture.auth.mockResolvedValue({ email: "operator@example.test" }); fixture.errorTable = ""; fixture.appendAfterSnapshot = false;
  const base = { variant_id: "pool", actor_email: "alex@example.test", reason: "received", order_id: null, reverses_receipt_id: null, created_at: "2026-09-17T01:00:00Z" };
  fixture.tables = {
    stock_movements: [{ ...base, id: "receipt", qty: 600, ledger_sequence: 1 }, ...Array.from({ length: 501 }, (_, i) => ({ ...base, id: `sale-${i}`, reason: "sale", actor_email: "operator@example.test", order_id: `order-${i}`, qty: -1, ledger_sequence: i + 2 }))],
    products: [{ id: "product", name: "Sample", slug: "sample", size_label: "10 mg", size_parent_id: null, product_variants: [{ id: "pool", pack_size: 1 }] }],
    admin_users: [{ id: "alex", email: "alex@example.test", name: "Alex Chen", active: true }],
    orders: Array.from({ length: 501 }, (_, i) => ({ id: `order-${i}`, order_number: `ECL-${i}` })),
  };
});

it("reads beyond one database page and resolves order links for the latest allocations", async () => {
  const report = await getStockAttribution();
  expect(report.totals).toMatchObject({ supplied: 600, sold: 501, remaining: 99 });
  expect(report.rows[0].sales).toHaveLength(10);
  expect(report.rows[0].sales[0]).toMatchObject({ orderId: "order-500", orderNumber: "ECL-500" });
  expect(JSON.stringify(report)).not.toContain("@example.test");
});

it("excludes stock appended after the report's ledger snapshot", async () => {
  fixture.appendAfterSnapshot = true;
  expect((await getStockAttribution()).totals.sold).toBe(501);
  expect(fixture.tables.stock_movements).toHaveLength(503);
});

it("excludes accessory boxes and packs from vial ownership totals", async () => {
  fixture.tables.products.push({ id: "swabs", name: "Swab packs", slug: "alcohol-swabs", categories: ["accessory"], size_label: null, size_parent_id: null, product_variants: [{ id: "accessory", pack_size: 1 }] });
  fixture.tables.stock_movements.push({ ...fixture.tables.stock_movements[0], id: "accessory-receipt", variant_id: "accessory", qty: 100, ledger_sequence: 1000 });
  const report = await getStockAttribution();
  expect(report.totals).toMatchObject({ supplied: 600, sold: 501, remaining: 99 });
  expect(report.rows.map(row => row.productName)).toEqual(["Sample"]);
});

it.each(["stock_movements", "admin_users", "products", "orders"])("surfaces a failed %s read instead of showing plausible partial totals", async table => {
  fixture.errorTable = table;
  await expect(getStockAttribution()).rejects.toThrow(/offline/);
});

it("requires admin access before reading the report", async () => {
  fixture.auth.mockRejectedValue(new Error("Forbidden"));
  await expect(getStockAttribution()).rejects.toThrow("Forbidden");
});
