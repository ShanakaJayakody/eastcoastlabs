import Link from "next/link";
import { Download, Plus } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { listProducts } from "@/lib/admin/products";
import ProductsTable from "@/components/admin/ProductsTable";

export const dynamic = "force-dynamic";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; low?: string }>;
}) {
  await requireAdmin();
  const { q, low } = await searchParams;
  const lowStockOnly = low === "1";
  const products = await listProducts({ search: q, lowStockOnly });

  const variantCount = products.reduce((s, p) => s + p.variants.length, 0);
  const lowCount = products.filter((p) => p.lowStock).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {products.length} products · {variantCount} variants
          {lowCount > 0 && !lowStockOnly && (
            <>
              {" · "}
              <Link href="/admin/products?low=1" className="text-warn hover:underline">
                {lowCount} low on stock
              </Link>
            </>
          )}
        </p>
        <div className="flex gap-2">
          <form action="/admin/products" className="flex gap-2">
            {lowStockOnly && <input type="hidden" name="low" value="1" />}
            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder="Search name or SKU"
              className="rounded-lg border border-line bg-ink-2 px-3 py-1.5 text-sm text-fg outline-none focus:border-accent"
            />
            <button className="rounded-lg border border-line-2 bg-surface px-3 py-1.5 text-sm text-fg-2 hover:text-fg">
              Search
            </button>
          </form>
          <a
            href="/admin/products/export"
            className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-fg-2 transition hover:text-fg"
          >
            <Download size={15} /> CSV
          </a>
          <Link
            href="/admin/products/new"
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink transition hover:brightness-95"
          >
            <Plus size={15} /> Add product
          </Link>
        </div>
      </div>

      {lowStockOnly && (
        <div className="flex items-center justify-between rounded-lg border border-warn/30 bg-warn/10 px-3 py-2 text-sm text-warn">
          <span>Showing only products at or below their low-stock threshold.</span>
          <Link href="/admin/products" className="text-xs underline">
            Show all
          </Link>
        </div>
      )}

      {products.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface p-10 text-center">
          <p className="text-fg">No products match.</p>
          <Link href="/admin/products" className="mt-2 inline-block text-sm text-accent-2 hover:underline">
            Clear filters
          </Link>
        </div>
      ) : (
        <ProductsTable products={products} />
      )}

      <p className="text-xs text-muted-2">
        Select variants to bulk-update stock or prices. Click a product to edit its details, tier
        pricing, and per-variant stock.
      </p>
    </div>
  );
}
