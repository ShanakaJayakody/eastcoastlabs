"use client";

import { useId, useRef } from "react";

import { useDialogFocus } from "./useDialogFocus";

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
  const dialogRef = useRef<HTMLDivElement>(null);
  const descriptionId = useId();
  useDialogFocus(open,dialogRef,onCancel,pending);

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
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-describedby={body ? descriptionId : undefined}
        aria-modal="true"
        aria-label={title}
        className="admin-card admin-enter w-full max-w-md rounded-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-fg">{title}</h2>
        {body && <div id={descriptionId} className="mt-2 text-sm text-fg-2">{body}</div>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            data-dialog-initial
            onClick={onCancel}
            disabled={pending}
            className="rounded-lg border border-line-2 px-3 py-1.5 text-sm text-fg-2 transition hover:bg-surface-2 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
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
