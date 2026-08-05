import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { comingSoonDemand } from "@/lib/coming-soon";

export const metadata: Metadata = { title: "Pipeline — ECL Admin" };
export const dynamic = "force-dynamic";

/**
 * The sourcing pipeline, ranked by real demand.
 *
 * Every "notify me" on a coming-soon product writes to stock_notifications, so
 * this page answers "what should I source next?" with ECL's own customers
 * voting — which beats inferring priority from what competitors happen to stock.
 *
 * Rank (the sourcing-effort order from SOURCING_LIST.md) is shown alongside, so
 * a compound with no signups yet still reads in a sensible order instead of
 * appearing arbitrary.
 */

const CATEGORY_LABEL: Record<string, string> = {
  "recovery-repair": "Recovery & Repair",
  "metabolic-weight": "Metabolic",
  "cognitive-focus": "Cognitive",
  "longevity-cellular": "Longevity",
  "skin-aesthetics": "Skin",
  "growth-performance": "Growth",
  "research-other": "Other",
};

export default async function PipelinePage() {
  await requireAdmin();
  const rows = await comingSoonDemand();

  const totalSignups = rows.reduce((s, r) => s + r.signups, 0);
  const withDemand = rows.filter((r) => r.signups > 0).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-fg">Pipeline</h1>
        <p className="mt-1 text-sm text-muted">
          Compounds listed as coming soon on the storefront, ranked by how many people asked to be
          notified. Signups are the demand signal — source from the top.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-xs text-muted">Coming soon</p>
          <p className="mt-1 text-2xl font-bold text-fg">{rows.length}</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-xs text-muted">Total signups</p>
          <p className="mt-1 text-2xl font-bold text-fg">{totalSignups}</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-xs text-muted">With demand</p>
          <p className="mt-1 text-2xl font-bold text-fg">{withDemand}</p>
        </div>
      </div>

      {totalSignups === 0 && (
        <div className="rounded-xl border border-dashed border-line-2 bg-surface/50 p-4 text-sm text-muted">
          No signups yet — the shelf has only just gone live. Until customers start voting, the
          order below is the sourcing-effort ranking from the competitor audit: things you can list
          without a new supplier come first.
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-medium">Compound</th>
              <th className="px-4 py-3 font-medium">Format</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 text-right font-medium">Signups</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.slug} className="border-b border-line last:border-0">
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/products/${r.slug}`}
                    className="font-medium text-fg hover:text-accent"
                  >
                    {r.name}
                  </Link>
                  <span className="ml-2 font-mono text-[11px] text-muted-2">#{r.rank}</span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-fg-2">{r.format ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-muted">
                  {r.categories.map((c) => CATEGORY_LABEL[c] ?? c).join(", ") || "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  {r.signups > 0 ? (
                    <span className="rounded-full bg-accent/15 px-2.5 py-1 text-xs font-bold text-accent">
                      {r.signups}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-2">0</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-2">
        To launch one: open it in Products, add its 1/3/6-vial tiers and price, receive stock, then
        switch its status from <span className="font-mono">coming_soon</span> to{" "}
        <span className="font-mono">active</span>. Everyone on its waitlist gets the back-in-stock
        email automatically.
      </p>
    </div>
  );
}
