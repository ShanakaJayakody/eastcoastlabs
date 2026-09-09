import Link from "next/link";
import { Download } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import {
  listPeoplePage,
  peopleSegmentCounts,
  SEGMENT_LABELS,
  type Segment,
} from "@/lib/admin/people";
import CustomersTable from "@/components/admin/CustomersTable";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

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
  searchParams: Promise<{ q?: string; segment?: string; page?: string }>;
}) {
  await requireAdmin();
  const { q, segment: rawSegment, page: rawPage } = await searchParams;
  const segment = (
    SEGMENT_ORDER.includes(rawSegment as Segment) ? rawSegment : "all"
  ) as Segment;

  let page=Math.max(1,parseInt(rawPage??"1",10)||1);
  const [counts,initial]=await Promise.all([peopleSegmentCounts(),listPeoplePage(segment,q,page,PAGE_SIZE)]);
  const total=initial.total;
  const pages=Math.max(1,Math.ceil(total/PAGE_SIZE));
  const result=page>pages ? await listPeoplePage(segment,q,pages,PAGE_SIZE) : initial;
  page=Math.min(page,pages);
  const rows=result.rows;
  const firstShown=total===0?0:(page-1)*PAGE_SIZE+1;
  const lastShown=(page-1)*PAGE_SIZE+rows.length;

  const hrefFor = (s: Segment) => {
    const params = new URLSearchParams();
    if (s !== "all") params.set("segment", s);
    if (q) params.set("q", q);
    const qs = params.toString();
    return `/admin/customers${qs ? `?${qs}` : ""}`;
  };

  const pageHref = (n: number) => {
    const params = new URLSearchParams();
    if (segment !== "all") params.set("segment", segment);
    if (q) params.set("q", q);
    if (n > 1) params.set("page", String(n));
    const qs = params.toString();
    return `/admin/customers${qs ? `?${qs}` : ""}`;
  };

  const exportHref = (() => {
    const params = new URLSearchParams();
    if (segment !== "all") params.set("segment", segment);
    if (q) params.set("q", q);
    const qs = params.toString();
    return `/admin/customers/export${qs ? `?${qs}` : ""}`;
  })();

  return (
    <div className="admin-stagger space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {total === 0
            ? `0 of ${counts.all} people`
            : `Showing ${firstShown}–${lastShown} of ${total}`}
          {segment !== "all" && ` · ${SEGMENT_LABELS[segment]}`}
          {total !== counts.all && ` · ${counts.all} in total`}
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
          <Link
            href={exportHref}
            prefetch={false}
            className="flex items-center gap-1.5 rounded-lg border border-line-2 bg-surface px-3 py-1.5 text-sm text-fg-2 transition hover:text-fg"
          >
            <Download size={14} /> Export
          </Link>
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

      <p className="text-xs text-muted">Purchase counts include confirmed paid orders, including later refunds. Lifetime value is paid total less recorded refunds. Cohort dates use payment time; older paid records without it use the legacy order date. Unpaid checkouts remain leads.</p>
      <CustomersTable rows={rows} />

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">
            Page {page} of {pages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={pageHref(page - 1)}
                className="rounded-lg border border-line px-3 py-1.5 text-fg-2 hover:text-fg"
              >
                Previous
              </Link>
            )}
            {page < pages && (
              <Link
                href={pageHref(page + 1)}
                className="rounded-lg border border-line px-3 py-1.5 text-fg-2 hover:text-fg"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}

      <p className="pb-20 text-xs text-muted-2">
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
