import Link from "next/link";
import { AlertTriangle, Boxes, Download, Package, Plus, Wallet } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { listProducts, type ProductListRow } from "@/lib/admin/products";
import { formatAud } from "@/lib/format";
import ProductsTable from "@/components/admin/ProductsTable";
import ProductSearch from "@/components/admin/ProductSearch";
import StatCard from "@/components/admin/StatCard";

export const dynamic = "force-dynamic";

/** Tabs in operator order: what's live first, the archive last. */
const TABS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "draft", label: "Draft" },
  { key: "coming_soon", label: "Coming soon" },
  { key: "archived", label: "Archived" },
  { key: "low", label: "Low stock" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const VALID = new Set<string>(TABS.map((t) => t.key));

function matchesSearch(p: ProductListRow, q: string): boolean {
  const s = q.toLowerCase();
  return (
    p.name.toLowerCase().includes(s) ||
    p.slug.includes(s) ||
    (p.sku ?? "").toLowerCase().includes(s) ||
    p.variants.some((v) => v.sku.toLowerCase().includes(s))
  );
}

const onTab = (p: ProductListRow, tab: TabKey) =>
  tab === "all" ? true : tab === "low" ? p.lowStock : p.status === tab;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; low?: string; status?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const search = sp.q?.trim() ?? "";

  // `?low=1` is kept working so existing links (dashboard, alerts) still land
  // on the low-stock view now that it's a tab rather than a boolean filter.
  const tab: TabKey = sp.low === "1" ? "low" : VALID.has(sp.status ?? "") ? (sp.status as TabKey) : "all";

  // One fetch: the stat strip needs the whole catalogue, the tab counts need
  // the search-filtered set, and the table needs both applied.
  const all = await listProducts();
  const found = search ? all.filter((p) => matchesSearch(p, search)) : all;
  const visible = found.filter((p) => onTab(p, tab));

  const counts = Object.fromEntries(
    TABS.map((t) => [t.key, found.filter((p) => onTab(p, t.key)).length]),
  ) as Record<TabKey, number>;

  const totalVials = all.reduce((s, p) => s + p.totalOnHand, 0);
  const lowCount = all.filter((p) => p.lowStock).length;
  const activeCount = all.filter((p) => p.status === "active").length;
  const costed = all.filter((p) => p.unit_cost_cents != null);
  const stockValue = costed.reduce((s, p) => s + (p.unit_cost_cents ?? 0) * p.totalOnHand, 0);
  const uncosted = all.length - costed.length;

  const tabHref = (key: TabKey) => {
    const p = new URLSearchParams();
    if (search) p.set("q", search);
    if (key !== "all") p.set("status", key);
    const qs = p.toString();
    return qs ? `/admin/products?${qs}` : "/admin/products";
  };

  return (
    <div className="space-y-5 pb-20">
      {/* Catalogue at a glance */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Products"
          value={String(all.length)}
          sub={`${activeCount} active`}
          icon={Package}
        />
        <StatCard
          label="Vials on hand"
          value={String(totalVials)}
          sub="across all products"
          icon={Boxes}
        />
        <Link href="/admin/products?status=low">
          <StatCard
            label="Low stock"
            value={String(lowCount)}
            sub={lowCount === 0 ? "all healthy" : "needs restocking"}
            icon={AlertTriangle}
            tone={lowCount > 0 ? "warn" : "default"}
            interactive
          />
        </Link>
        <StatCard
          label="Stock at cost"
          value={formatAud(stockValue / 100)}
          sub={uncosted > 0 ? `${uncosted} without a cost set` : "all products costed"}
          icon={Wallet}
        />
      </div>

      {/* Filters + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((t) => {
            const n = counts[t.key];
            const active = tab === t.key;
            return (
              <Link
                key={t.key}
                href={tabHref(t.key)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition ${
                  active
                    ? "border-accent/40 bg-accent/10 text-accent"
                    : "border-line bg-surface text-muted hover:text-fg-2"
                }`}
              >
                {t.label}
                {n > 0 && (
                  <span
                    className={`rounded-full px-1.5 text-[10px] font-semibold ${
                      active ? "bg-accent/20" : "bg-line text-fg-2"
                    }`}
                  >
                    {n}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <ProductSearch initial={search} />
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

      {visible.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface p-10 text-center">
          <p className="text-fg">
            {search ? `No products match “${search}”.` : "Nothing in this view."}
          </p>
          <p className="mt-1 text-sm text-muted">
            {tab === "low"
              ? "Every product is above its low-stock threshold."
              : "Try another filter or clear your search."}
          </p>
          {(search || tab !== "all") && (
            <Link
              href="/admin/products"
              className="mt-3 inline-block text-sm text-accent-2 hover:underline"
            >
              Clear filters
            </Link>
          )}
        </div>
      ) : (
        <ProductsTable products={visible} />
      )}
    </div>
  );
}
