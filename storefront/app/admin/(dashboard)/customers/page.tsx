import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { formatAud } from "@/lib/format";
import {
  listPeople,
  filterPeople,
  segmentCounts,
  hoursLabel,
  SEGMENT_LABELS,
  type Segment,
} from "@/lib/admin/people";
import Badge from "@/components/admin/Badge";

export const dynamic = "force-dynamic";

const cents = (c: number) => formatAud(c / 100);

const SEGMENT_ORDER: Segment[] = [
  "all",
  "in_recovery",
  "vip",
  "repeat",
  "one_time",
  "at_risk",
  "lapsed",
  "leads",
  "unsubscribed",
];

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; segment?: string }>;
}) {
  await requireAdmin();
  const { q, segment: rawSegment } = await searchParams;
  const segment = (
    SEGMENT_ORDER.includes(rawSegment as Segment) ? rawSegment : "all"
  ) as Segment;

  const people = await listPeople();
  const counts = segmentCounts(people);
  const rows = filterPeople(people, segment, q).slice(0, 200);

  const hrefFor = (s: Segment) => {
    const params = new URLSearchParams();
    if (s !== "all") params.set("segment", s);
    if (q) params.set("q", q);
    const qs = params.toString();
    return `/admin/customers${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="admin-stagger space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {rows.length} of {counts.all} people
          {segment !== "all" && ` · ${SEGMENT_LABELS[segment]}`}
        </p>
        <form action="/admin/customers" className="flex gap-2">
          {segment !== "all" && <input type="hidden" name="segment" value={segment} />}
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search name or email"
            className="rounded-lg border border-line bg-ink-2 px-3 py-1.5 text-sm text-fg outline-none focus:border-accent"
          />
          <button className="rounded-lg border border-line-2 bg-surface px-3 py-1.5 text-sm text-fg-2 hover:text-fg">
            Search
          </button>
        </form>
      </div>

      {/* Segments are the primary navigation here — most admin questions start
          with "which group?" rather than "which person?". */}
      <div className="flex flex-wrap gap-2">
        {SEGMENT_ORDER.map((s) => {
          const active = s === segment;
          return (
            <Link
              key={s}
              href={hrefFor(s)}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                active
                  ? "border-accent/40 bg-accent/10 text-accent"
                  : "border-line bg-surface text-muted hover:border-line-2 hover:text-fg-2"
              }`}
            >
              {SEGMENT_LABELS[s]}
              <span className="ml-1.5 tabular-nums opacity-70">{counts[s]}</span>
            </Link>
          );
        })}
      </div>

      <div className="admin-card overflow-hidden rounded-xl">
        {rows.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted">Nobody matches this view.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-ink-2 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">Person</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Last order</th>
                <th className="px-4 py-2.5 text-right font-medium">Lifetime value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((p) => (
                <tr key={p.email} className="transition hover:bg-surface-2/50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/customers/${encodeURIComponent(p.email)}`}
                      className="text-fg-2 hover:text-accent"
                    >
                      {p.name || p.email}
                    </Link>
                    {p.name && <span className="block text-xs text-muted">{p.email}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {p.cartValueCents !== null && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-xs text-accent"
                          title={`Cart ${cents(p.cartValueCents)} · idle ${hoursLabel(p.cartIdleHours)} · touch ${p.cartStage ?? 0}/3`}
                        >
                          <ShoppingCart size={11} />
                          {p.cartStage ? `recovery ${p.cartStage}/3` : "cart open"}
                        </span>
                      )}
                      {p.ordersCount === 0 && p.cartValueCents === null && (
                        <Badge tone="info">lead</Badge>
                      )}
                      {p.segments.includes("vip") && <Badge tone="success">VIP</Badge>}
                      {p.segments.includes("lapsed") && <Badge tone="warn">lapsed</Badge>}
                      {p.unsubscribed && <Badge tone="neutral">unsub</Badge>}
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-muted sm:table-cell">
                    {p.lastOrderAt ? new Date(p.lastOrderAt).toLocaleDateString("en-AU") : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums text-fg">
                    {p.ordersCount > 0 ? cents(p.ltvCents) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-muted-2">
        <Link href="/admin/recovery" className="text-accent-2 hover:underline">
          Cart recovery centre
        </Link>{" "}
        ·{" "}
        <Link href="/admin/orders" className="text-accent-2 hover:underline">
          View all orders
        </Link>
      </p>
    </div>
  );
}
