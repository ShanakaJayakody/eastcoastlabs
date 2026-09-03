"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MailX, ShoppingCart, Tag } from "lucide-react";
import { formatAud } from "@/lib/format";
// Type-only: `lib/admin/people` is server-only, and a value import from a
// client component drags the whole server module into the browser bundle.
import type { PersonRow } from "@/lib/admin/people";
import { bulkAddTag, bulkSuppressMarketing } from "@/app/admin/(dashboard)/customers/actions";
import Badge from "./Badge";
import ConfirmModal from "./ConfirmModal";

const cents = (c: number) => formatAud(c / 100);

/** Client-side twin of the server helper — see the import note above. */
function idleLabel(hours: number | null): string {
  if (hours == null) return "";
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
  if (hours < 48) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}

type BulkKind = "unsubscribe" | "tag";

export default function CustomersTable({ rows }: { rows: PersonRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState<BulkKind | null>(null);
  const [tag, setTag] = useState("");

  // Paging and filtering are soft navigations, so this component is reconciled
  // rather than remounted and a selection would quietly survive into a view
  // where those people are no longer visible. Acting on 41 people while the
  // button says 1 is the failure mode; the selection resets with the rows.
  const signature = rows.map((r) => r.email).join(",");
  const [lastSignature, setLastSignature] = useState(signature);
  if (lastSignature !== signature) {
    setLastSignature(signature);
    setSelected(new Set());
    setConfirming(null);
  }

  const toggle = (email: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.email));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.email)));

  // Always derived from what is on screen, so the count in the button, the
  // count in the dialog and the list sent to the server cannot disagree.
  const selectedRows = rows.filter((r) => selected.has(r.email));
  const emails = selectedRows.map((r) => r.email);
  // Suppressing someone already suppressed is a no-op, so the count that
  // matters is how many will actually change.
  const stillSubscribed = selectedRows.filter((r) => !r.unsubscribed);

  const finish = (res: { ok: boolean; message?: string; changed?: number; failed?: string[] }) => {
    if (!res.ok) {
      toast.error(res.message ?? "That didn't go through");
      return;
    }
    toast.success(res.message ?? "Done");
    if (res.failed?.length) {
      toast.error(`${res.failed.length} could not be updated: ${res.failed.slice(0, 3).join(", ")}`);
    }
    setSelected(new Set());
    setConfirming(null);
    setTag("");
    router.refresh();
  };

  const runUnsubscribe = () =>
    start(async () => finish(await bulkSuppressMarketing(stillSubscribed.map((r) => r.email))));
  const runTag = () => start(async () => finish(await bulkAddTag(emails, tag)));

  return (
    <>
      <div className="admin-card overflow-hidden rounded-xl">
        {rows.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted">Nobody matches this view.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-ink-2 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="w-10 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Select everyone on this page"
                    className="h-4 w-4 accent-[var(--color-accent)]"
                  />
                </th>
                <th className="px-4 py-2.5 font-medium">Person</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Last order</th>
                <th className="px-4 py-2.5 text-right font-medium">Lifetime value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((p) => (
                <tr
                  key={p.email}
                  className={`transition hover:bg-surface-2/50 ${
                    selected.has(p.email) ? "bg-accent/5" : ""
                  }`}
                >
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(p.email)}
                      onChange={() => toggle(p.email)}
                      aria-label={`Select ${p.email}`}
                      className="h-4 w-4 accent-[var(--color-accent)]"
                    />
                  </td>
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
                          title={`Cart ${cents(p.cartValueCents)} · idle ${idleLabel(p.cartIdleHours)} · touch ${p.cartStage ?? 0}/3`}
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

      {/* Bulk action bar — mirrors the orders list so the two feel like one admin. */}
      <div
        className={`fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/95 backdrop-blur transition-transform duration-200 ${
          selectedRows.length > 0 ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <p className="text-sm text-fg-2">{selectedRows.length} selected</p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setSelected(new Set())}
              className="rounded-lg border border-line-2 px-3 py-2 text-sm text-fg-2 transition hover:text-fg"
            >
              Clear
            </button>
            <input
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="Tag name"
              aria-label="Tag to apply"
              className="w-32 rounded-lg border border-line bg-ink-2 px-3 py-2 text-sm text-fg outline-none focus:border-accent"
            />
            <button
              disabled={pending || !tag.trim()}
              onClick={() => setConfirming("tag")}
              className="flex items-center gap-1.5 rounded-lg border border-line-2 bg-surface px-3 py-2 text-sm text-fg-2 transition hover:text-fg disabled:opacity-40"
            >
              <Tag size={15} /> Tag
            </button>
            <button
              disabled={pending || stillSubscribed.length === 0}
              onClick={() => setConfirming("unsubscribe")}
              className="flex items-center gap-1.5 rounded-lg bg-red-500/90 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-40"
            >
              <MailX size={15} />
              {pending ? "Working…" : `Unsubscribe ${stillSubscribed.length}`}
            </button>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={confirming !== null}
        title={confirming === "tag" ? "Tag these people?" : "Suppress marketing for these people?"}
        body={
          confirming === "tag" ? (
            <>
              <p className="font-medium text-fg">
                {selectedRows.length} {selectedRows.length === 1 ? "person" : "people"} tagged
                &ldquo;{tag.trim()}&rdquo;
              </p>
              <p className="mt-1.5 text-muted">
                Tags they already have are kept — this adds one, it does not replace the rest.
              </p>
            </>
          ) : (
            <>
              <p className="font-medium text-fg">
                {stillSubscribed.length} {stillSubscribed.length === 1 ? "person" : "people"} opted out
              </p>
              <p className="mt-1.5 text-muted">
                They stop receiving marketing and lifecycle email immediately. Receipts, dispatch
                notices and other transactional email still send. Re-subscribing has to be done one
                person at a time.
              </p>
            </>
          )
        }
        confirmLabel={confirming === "tag" ? "Add tag" : "Suppress marketing"}
        tone={confirming === "unsubscribe" ? "danger" : "default"}
        pending={pending}
        onConfirm={() => (confirming === "tag" ? runTag() : runUnsubscribe())}
        onCancel={() => setConfirming(null)}
      />
    </>
  );
}
