import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "success" | "warn" | "danger" | "info";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-surface-2 text-fg-2 border-line-2",
  success: "bg-success/10 text-success border-success/30",
  warn: "bg-warn/10 text-warn border-warn/30",
  danger: "bg-red-500/10 text-red-400 border-red-500/30",
  info: "bg-accent-2/10 text-accent-2 border-accent-2/30",
};

/** Status chip with one consistent color semantic across the whole admin. */
export default function Badge({
  tone = "neutral",
  children,
}: {
  tone?: BadgeTone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
