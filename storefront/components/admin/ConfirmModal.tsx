"use client";

import { useEffect, useRef } from "react";

/** Controlled confirmation dialog — the admin never uses window.confirm, which blocks automation and can't be themed. */
export default function ConfirmModal({
  open,
  title,
  body,
  confirmLabel,
  tone = "default",
  pending = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body?: React.ReactNode;
  confirmLabel: string;
  tone?: "default" | "danger";
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) confirmRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // Escape must not abandon an in-flight mutation — the caller owns the outcome until it settles.
      if (e.key === "Escape" && !pending) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pending, onCancel]);

  if (!open) return null;

  const confirmClass =
    tone === "danger"
      ? "bg-red-500/90 text-white hover:bg-red-500"
      : "bg-accent text-accent-ink hover:opacity-90";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4 backdrop-blur-sm"
      onClick={() => {
        if (!pending) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="admin-card admin-enter w-full max-w-md rounded-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-fg">{title}</h2>
        {body && <div className="mt-2 text-sm text-fg-2">{body}</div>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="rounded-lg border border-line-2 px-3 py-1.5 text-sm text-fg-2 transition hover:bg-surface-2 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:opacity-60 ${confirmClass}`}
          >
            {pending ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
