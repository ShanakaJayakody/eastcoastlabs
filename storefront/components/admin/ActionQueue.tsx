"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  CheckCircle2,
  PackageCheck,
  Star,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AttentionItem, AttentionKind, AttentionQueue } from "@/lib/admin/attention";
import { advanceStatus, confirmPayment } from "@/app/admin/(dashboard)/orders/actions";
import { setReviewStatus } from "@/app/admin/(dashboard)/reviews/actions";
import ConfirmModal from "./ConfirmModal";
import Badge from "./Badge";

const KIND_META: Record<AttentionKind, { icon: LucideIcon; label: string; tint: string }> = {
  payment: { icon: Banknote, label: "Awaiting payment", tint: "bg-warn/10 text-warn" },
  fulfil: { icon: PackageCheck, label: "To pack", tint: "bg-accent/10 text-accent" },
  review: { icon: Star, label: "Review", tint: "bg-accent-2/10 text-accent-2" },
  restock: { icon: BadgeCheck, label: "Restock", tint: "bg-surface-2 text-muted" },
};

/** Where "see the rest" goes for each kind, once the queue is truncated. */
const KIND_HREF: Record<AttentionKind, string> = {
  payment: "/admin/orders?status=pending",
  fulfil: "/admin/orders?status=to_fulfil",
  review: "/admin/reviews",
  restock: "/admin/products?low=1",
};

const CONFIRM_TITLE: Record<string, string> = {
  ship: "Mark this order shipped?",
  confirm: "Confirm this payment?",
  approve: "Publish this review?",
};

export default function ActionQueue({ queue }: { queue: AttentionQueue }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<AttentionItem | null>(null);

  const run = (item: AttentionItem) => {
    const action = item.action;
    if (!action) return;
    startTransition(async () => {
      try {
        const result =
          action.verb === "ship"
            ? await advanceStatus(action.targetId, "shipped")
            : action.verb === "confirm"
              ? await confirmPayment(action.targetId)
              : await setReviewStatus(action.targetId, "published");
        if (!result.ok) {
          toast.error(result.error ?? "That didn't go through");
          return;
        }
        toast.success(
          action.verb === "ship"
            ? "Marked shipped — dispatch email queued"
            : action.verb === "confirm"
              ? "Payment confirmed — receipt queued"
              : "Review published",
        );
        setConfirming(null);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "That didn't go through");
      }
    });
  };

  // What is hidden, and where "more waiting" should actually go. Sending a
  // truncated list of restock items to /admin/orders would be a dead end.
  const shownByKind = queue.items.reduce<Record<string, number>>((acc, item) => {
    acc[item.kind] = (acc[item.kind] ?? 0) + 1;
    return acc;
  }, {});
  const hiddenByKind = (Object.keys(KIND_META) as AttentionKind[])
    .map((kind) => ({ kind, count: queue.counts[kind] - (shownByKind[kind] ?? 0) }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count);
  const hidden = hiddenByKind.reduce((sum, entry) => sum + entry.count, 0);
  const hiddenHref = hiddenByKind.length ? KIND_HREF[hiddenByKind[0].kind] : "/admin/orders";

  return (
    <section className="admin-card overflow-hidden rounded-2xl">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-fg">Needs you</h3>
          {queue.total > 0 && (
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium tabular-nums text-fg-2">
              {queue.total}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {(Object.keys(KIND_META) as AttentionKind[])
            .filter((kind) => queue.counts[kind] > 0)
            .map((kind) => (
              <Link
                key={kind}
                href={KIND_HREF[kind]}
                className="rounded-full border border-line-2 px-2 py-0.5 text-[11px] text-muted transition hover:border-accent/40 hover:text-fg-2"
              >
                {queue.counts[kind]} {KIND_META[kind].label.toLowerCase()}
              </Link>
            ))}
        </div>
      </div>

      {queue.items.length === 0 ? (
        <div className="flex items-center gap-3 px-4 py-8">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-success/10 text-success">
            <CheckCircle2 size={18} />
          </span>
          <div>
            <p className="text-sm font-medium text-fg">Nothing waiting.</p>
            <p className="text-xs text-muted">
              Every order is packed, every transfer confirmed, every review moderated.
            </p>
          </div>
        </div>
      ) : (
        <div className="divide-y divide-line">
          {queue.items.map((item) => {
            const meta = KIND_META[item.kind];
            const Icon = meta.icon;
            return (
              /* Stacks on a phone: identity on top, then age and the action on
                 their own row with a full-width tap target. Wrapping a 44px
                 button into a flex row at 375px is what made this unusable. */
              <div
                key={item.id}
                className="px-4 py-3 transition hover:bg-surface-2/40 sm:flex sm:items-center sm:gap-3"
              >
                <div className="flex min-w-0 items-center gap-3 sm:flex-1">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${meta.tint}`}
                  >
                    <Icon size={15} />
                  </span>
                  <Link href={item.href} className="group min-w-0 flex-1">
                    <div className="truncate text-sm text-fg-2 group-hover:text-fg">{item.title}</div>
                    <div className="truncate text-xs text-muted">{item.detail}</div>
                  </Link>
                  <span className="shrink-0 sm:hidden">
                    {item.urgent ? (
                      <Badge tone="warn">{item.ageLabel}</Badge>
                    ) : (
                      <span className="text-xs tabular-nums text-muted-2">{item.ageLabel}</span>
                    )}
                  </span>
                </div>

                <span className="hidden shrink-0 sm:inline">
                  {item.urgent ? (
                    <Badge tone="warn">{item.ageLabel}</Badge>
                  ) : (
                    <span className="text-xs tabular-nums text-muted-2">{item.ageLabel}</span>
                  )}
                </span>

                <div className="mt-2.5 pl-11 sm:mt-0 sm:pl-0">
                  {item.action ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => setConfirming(item)}
                      className="w-full rounded-lg border border-line-2 px-2.5 py-2 text-xs font-medium text-fg-2 transition hover:border-accent/40 hover:bg-surface-2 hover:text-fg disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] sm:w-auto sm:py-1.5"
                    >
                      {item.action.label}
                    </button>
                  ) : (
                    <Link
                      href={item.href}
                      className="flex w-full items-center justify-center gap-1 rounded-lg border border-line-2 px-2.5 py-2 text-xs font-medium text-fg-2 transition hover:border-accent/40 hover:bg-surface-2 hover:text-fg sm:w-auto sm:py-1.5"
                    >
                      Open <ArrowRight size={12} />
                    </Link>
                  )}
                </div>
              </div>
            );
          })}

          {hidden > 0 && (
            <Link
              href={hiddenHref}
              className="block px-4 py-2.5 text-xs text-accent-2 transition hover:bg-surface-2/40 hover:underline"
            >
              {hidden} more waiting
            </Link>
          )}
        </div>
      )}

      <ConfirmModal
        open={confirming !== null}
        title={confirming?.action ? CONFIRM_TITLE[confirming.action.verb] : ""}
        body={
          confirming && (
            <>
              <p className="font-medium text-fg">{confirming.title}</p>
              <p className="mt-1.5 text-muted">{confirming.action?.consequence}</p>
            </>
          )
        }
        confirmLabel={confirming?.action?.label ?? "Confirm"}
        pending={pending}
        onConfirm={() => confirming && run(confirming)}
        onCancel={() => setConfirming(null)}
      />
    </section>
  );
}
