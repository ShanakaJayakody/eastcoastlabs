import { Check, Minus } from "lucide-react";

export interface StepperStep {
  label: string;
  state: "sent" | "next" | "pending" | "skipped" | "missed";
  at?: string | null;
  etaMs?: number | null;
  detail?: string | null;
}

/** Compact "2h ago" / "3d ago" for a past ISO timestamp. Returns null on bad input. */
function relativePast(iso?: string | null): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const diff = Math.max(0, Date.now() - then);
  const m = Math.round(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/** Compact "in ~22h" for a forward-looking duration. Negative means it is already due. */
function relativeFuture(ms?: number | null): string | null {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return null;
  if (ms <= 0) return "due now";
  const m = Math.round(ms / 60_000);
  if (m < 1) return "due now";
  if (m < 60) return `in ~${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `in ~${h}h`;
  return `in ~${Math.round(h / 24)}d`;
}

/** The caption under a node depends on state: sent looks backward, next looks forward. */
function caption(step: StepperStep): string {
  if (step.state === "sent") return relativePast(step.at) ?? (step.detail || "sent");
  if (step.state === "next") return relativeFuture(step.etaMs) ?? (step.detail || "scheduled");
  return step.detail || step.state;
}

function Node({ state }: { state: StepperStep["state"] }) {
  const base =
    "relative z-10 flex h-5 w-5 items-center justify-center rounded-full border bg-ink";
  switch (state) {
    case "sent":
      return (
        <span className={`${base} border-accent bg-accent text-accent-ink`}>
          <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
        </span>
      );
    case "next":
      return (
        <span className={`${base} border-accent-2 bg-accent-2/20 ring-2 ring-accent-2/30`}>
          <span className="h-2 w-2 animate-pulse rounded-full bg-accent-2" />
        </span>
      );
    case "skipped":
      return (
        <span className={`${base} border-line-2 text-muted-2`}>
          <Minus className="h-3 w-3" strokeWidth={3} aria-hidden />
        </span>
      );
    case "missed":
      return <span className={`${base} border-warn/60 bg-warn/10`} />;
    default:
      return <span className={`${base} border-line-2`} />;
  }
}

/** Horizontal progress rail for a scheduled email/reminder sequence. */
export default function SequenceStepper({
  steps,
  compact,
}: {
  steps: StepperStep[];
  compact?: boolean;
}) {
  if (!steps.length) return null;

  if (compact) {
    return (
      <div className="flex max-w-full items-center overflow-x-auto">
        {steps.map((step, i) => (
          <div key={`${step.label}-${i}`} className="flex flex-none items-center">
            {i > 0 && <span className="h-px w-4 bg-line-2" aria-hidden />}
            <span title={`${step.label} — ${caption(step)}`}>
              <Node state={step.state} />
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-full overflow-x-auto">
      <div className="flex min-w-max items-start">
        {steps.map((step, i) => (
          <div key={`${step.label}-${i}`} className="flex flex-none items-start">
            {/* Connector sits at node height so the rail reads as one continuous line. */}
            {i > 0 && <span className="mt-2.5 h-px w-10 bg-line-2 sm:w-14" aria-hidden />}
            <div className="flex w-24 flex-col items-center gap-1 text-center">
              <Node state={step.state} />
              <span className="text-xs font-medium text-fg-2">{step.label}</span>
              <span className="text-[11px] leading-tight text-muted">{caption(step)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
