"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Badge, { type BadgeTone } from "./Badge";
import {
  creatorStatusLabel,
  type CreatorAdminActionResult,
  type ReviewCreatorApplicationInput,
} from "@/lib/creators/admin";
import type { ApplicationStatus, CreatorApplicationRow } from "@/lib/creators/types";

const STATUSES: ApplicationStatus[] = ["new", "shortlisted", "accepted", "declined"];
const tone: Record<ApplicationStatus, BadgeTone> = {
  new: "warn",
  shortlisted: "info",
  accepted: "success",
  declined: "neutral",
};
const field =
  "w-full rounded-lg border border-line bg-ink-2 px-3 py-2 text-sm text-fg outline-none focus:border-accent";
const button = "rounded-lg px-3 py-2 text-sm font-medium transition disabled:opacity-50";

function external(url: string, label: string) {
  if (!url) return <span className="text-muted">—</span>;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2">
      {label}
    </a>
  );
}

function fmt(value: string) {
  return new Date(value).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" });
}

function allowedFrom(status: ApplicationStatus): ApplicationStatus[] {
  if (status === "new") return ["new", "shortlisted", "declined"];
  if (status === "shortlisted") return ["shortlisted", "accepted", "declined"];
  return [status];
}

function provided(value: string | null | undefined) {
  return value?.trim() || "Not provided";
}

function focusSummary(application: CreatorApplicationRow) {
  const detail = application.focus_detail?.trim();
  return application.focus === "other" && detail ? `${application.focus}: ${detail}` : application.focus;
}

function audienceSummary(application: CreatorApplicationRow) {
  if (typeof application.audience_size === "number") return String(application.audience_size);
  return application.audience || "Not provided";
}

export default function CreatorApplicationDetail({
  application,
  review,
}: {
  application: CreatorApplicationRow;
  review?: (input: ReviewCreatorApplicationInput) => Promise<CreatorAdminActionResult>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<ApplicationStatus>(application.status);
  const [notes, setNotes] = useState(application.internal_notes ?? "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);
  const choices = allowedFrom(application.status);

  useEffect(() => {
    setStatus(application.status);
    setNotes(application.internal_notes ?? "");
    setMessage("");
    setError("");
    setStale(false);
  }, [application.id, application.revision, application.status, application.internal_notes]);

  const save = () => {
    if (!review || stale) return;
    setError("");
    setMessage("");
    setStale(false);
    start(async () => {
      const result = await review({
        id: application.id,
        expectedRevision: application.revision,
        status,
        notes,
      });
      if (result.ok) {
        setMessage(result.message ?? "Application saved.");
        router.refresh();
      } else {
        setError(result.error ?? "Application could not be saved.");
        setStale(Boolean(result.stale));
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/creators" className="text-sm text-muted underline hover:text-accent">
            Back to creators
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-fg">{application.name}</h1>
          <p className="mt-1 text-sm text-muted">
            Submitted {fmt(application.created_at)} · Revision {application.revision}
          </p>
        </div>
        <Badge tone={tone[application.status]}>{creatorStatusLabel(application.status)}</Badge>
      </div>

      <section className="grid gap-4 rounded-xl border border-line bg-surface p-5 md:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">Email</p>
          <p className="mt-1 break-all text-sm text-fg">{application.email}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">Phone</p>
          <p className="mt-1 break-all text-sm text-fg">{provided(application.phone)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">Profile</p>
          <p className="mt-1 text-sm">{external(application.social_url, "Open social profile")}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">Portfolio</p>
          <p className="mt-1 text-sm">{external(application.portfolio_url, "Open portfolio")}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">Focus</p>
          <p className="mt-1 text-sm text-fg">
            {focusSummary(application)} · {application.discipline} · {application.region}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">Audience</p>
          <p className="mt-1 text-sm text-fg">{audienceSummary(application)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">Consent</p>
          <p className="mt-1 text-sm text-fg">
            {application.privacy_version} · {fmt(application.consent_at)}
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="text-base font-semibold text-fg">Application pitch</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-fg-2">{application.pitch}</p>
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="text-base font-semibold text-fg">Review</h2>
        <p className="mt-1 text-sm text-muted">
          Acceptance changes this private record only. It does not send a message, create a contract or make a payment.
        </p>
        <div className="mt-4 grid gap-3">
          <label className="grid gap-1 text-sm font-medium text-fg">
            Status
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as ApplicationStatus)}
              className={field}
              disabled={pending || !review || stale}
            >
              {STATUSES.map((value) => (
                <option key={value} value={value} disabled={!choices.includes(value)}>
                  {creatorStatusLabel(value)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium text-fg">
            Internal notes
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={7}
              maxLength={5000}
              className={field}
              disabled={pending || !review || stale}
            />
          </label>
          {message && <p role="status" className="rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-success">{message}</p>}
          {error && (
            <div role="alert" className="rounded-lg border border-warn/30 bg-warn/10 p-3 text-sm text-warn">
              <p>{error}</p>
              {stale && (
                <button type="button" onClick={() => router.refresh()} className="mt-2 underline">
                  Reload application
                </button>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={save}
            disabled={pending || !review || stale}
            className={`${button} w-fit bg-accent text-accent-ink hover:brightness-95`}
          >
            {pending ? "Saving review..." : "Save review"}
          </button>
        </div>
      </section>
    </div>
  );
}
