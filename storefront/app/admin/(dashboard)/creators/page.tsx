import type { Metadata } from "next";
import Link from "next/link";
import Badge, { type BadgeTone } from "@/components/admin/Badge";
import {
  creatorStatusLabel,
  listCreatorApplications,
  type CreatorApplicationListRow,
} from "@/lib/admin/creators";
import type { ApplicationStatus } from "@/lib/creators/types";

export const metadata: Metadata = { title: "Creators — ECL Admin" };
export const dynamic = "force-dynamic";

const STATUSES: ApplicationStatus[] = ["new", "shortlisted", "accepted", "declined"];
const tone: Record<ApplicationStatus, BadgeTone> = {
  new: "warn",
  shortlisted: "info",
  accepted: "success",
  declined: "neutral",
};

function fmt(value: string) {
  return new Date(value).toLocaleDateString("en-AU", { dateStyle: "medium" });
}

function statusHref(status?: ApplicationStatus) {
  return status ? `/admin/creators?status=${status}` : "/admin/creators";
}

function pageHref(page: number, status?: ApplicationStatus) {
  const params = new URLSearchParams({ page: String(page) });
  if (status) params.set("status", status);
  return `/admin/creators?${params.toString()}`;
}

function ApplicationRow({ row }: { row: CreatorApplicationListRow }) {
  return (
    <tr className="border-b border-line last:border-0">
      <td className="px-4 py-3">
        <Link href={`/admin/creators/${row.id}`} className="font-medium text-fg hover:text-accent">
          {row.name}
        </Link>
        <p className="mt-0.5 break-all text-xs text-muted">{row.email}</p>
      </td>
      <td className="px-4 py-3 text-sm text-fg-2">
        <span className="capitalize">{row.focus}</span>
        <p className="mt-0.5 text-xs text-muted">{row.discipline} · {row.region}</p>
      </td>
      <td className="px-4 py-3">
        <Badge tone={tone[row.status]}>{creatorStatusLabel(row.status)}</Badge>
      </td>
      <td className="px-4 py-3 text-sm text-muted">{fmt(row.created_at)}</td>
      <td className="px-4 py-3 text-right">
        <a href={row.social_url} target="_blank" rel="noopener noreferrer" className="text-sm text-accent underline underline-offset-2">
          Profile
        </a>
      </td>
    </tr>
  );
}

export default async function CreatorsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const applications = await listCreatorApplications({ status: sp.status, page: sp.page });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-fg">Creators</h1>
        <p className="mt-1 text-sm text-muted">
          Review creator applications. Accepting a record here is administrative only; outreach and contracts remain separate.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Link
            href={statusHref()}
            className={`rounded-full border px-3 py-1 text-xs ${!applications.status ? "border-accent bg-accent/10 text-accent" : "border-line text-muted hover:text-fg"}`}
          >
            All
          </Link>
          {STATUSES.map((value) => (
            <Link
              key={value}
              href={statusHref(value)}
              className={`rounded-full border px-3 py-1 text-xs ${applications.status === value ? "border-accent bg-accent/10 text-accent" : "border-line text-muted hover:text-fg"}`}
            >
              {creatorStatusLabel(value)}
            </Link>
          ))}
        </div>
        <p className="text-sm text-muted">{applications.total} application{applications.total === 1 ? "" : "s"}</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {applications.rows.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted">No creator applications match this view.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-ink-2 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Applicant</th>
                <th className="px-4 py-3 font-medium">Focus</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Submitted</th>
                <th className="px-4 py-3 text-right font-medium">Links</th>
              </tr>
            </thead>
            <tbody>
              {applications.rows.map((row) => <ApplicationRow key={row.id} row={row} />)}
            </tbody>
          </table>
        )}
      </div>

      {applications.pages > 1 && (
        <div className="flex items-center gap-2 text-sm text-muted">
          <span>Page {applications.page} of {applications.pages}</span>
          {applications.page > 1 && <Link href={pageHref(applications.page - 1, applications.status)} className="underline">Previous</Link>}
          {applications.page < applications.pages && <Link href={pageHref(applications.page + 1, applications.status)} className="underline">Next</Link>}
        </div>
      )}
    </div>
  );
}
