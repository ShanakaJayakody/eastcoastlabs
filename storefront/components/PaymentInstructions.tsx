"use client";

import { useState } from "react";
import type { PaymentInstructions } from "@/lib/payments";

/**
 * The payment details panel, with a copy button on every field.
 *
 * Copy buttons are not decoration here. A customer-initiated transfer is
 * matched on the reference and the exact cent amount, so a single mistyped
 * digit turns an automatic match into a support ticket. Australia's PayID
 * infrastructure providers gate merchant production access on this for exactly
 * that reason.
 */
export default function PaymentInstructionsPanel({
  instructions,
  compact = false,
}: {
  instructions: PaymentInstructions;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard can be blocked (insecure context, permissions). The value is
      // on screen and selectable either way — just don't claim it copied.
      return;
    }
    setCopied(label);
    window.setTimeout(() => setCopied((c) => (c === label ? null : c)), 1600);
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-fg">
          {instructions.method === "payid" ? "Pay by PayID" : "Pay by bank transfer"}
        </h2>
        <span className="rounded-full bg-success/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-success">
          Fee free
        </span>
      </div>

      <dl className="mt-4 divide-y divide-line rounded-lg border border-line bg-ink-2">
        {instructions.fields.map((f) => (
          <div key={f.label} className="flex items-center justify-between gap-3 px-3 py-2.5">
            <dt className="shrink-0 text-xs text-muted">{f.label}</dt>
            <dd className="flex min-w-0 items-center gap-2">
              <span
                className={`truncate text-sm font-semibold text-fg ${
                  f.mono ? "font-mono tracking-wide" : ""
                }`}
              >
                {f.value}
              </span>
              {f.copyable && (
                <button
                  type="button"
                  onClick={() => copy(f.label, f.value)}
                  className="shrink-0 rounded-md border border-line-2 px-2 py-1 text-[11px] font-medium text-fg-2 transition hover:border-accent hover:text-accent"
                  aria-label={`Copy ${f.label}`}
                >
                  {copied === f.label ? "Copied" : "Copy"}
                </button>
              )}
            </dd>
          </div>
        ))}
      </dl>

      {!compact && (
        <ul className="mt-4 space-y-2 text-xs leading-relaxed text-muted">
          {instructions.notes.map((n) => (
            <li key={n} className="flex gap-2">
              <span aria-hidden className="mt-px text-accent">
                •
              </span>
              <span>{n}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
