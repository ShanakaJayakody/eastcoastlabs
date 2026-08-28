"use client";

/**
 * The interactive half of Customer 360 and the recovery centre.
 *
 * Every mutating control routes through ConfirmModal rather than window.confirm:
 * native dialogs can't be themed and are auto-dismissed by browser automation,
 * which makes them both worse UX and untestable.
 */
import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import {
  BellOff,
  BellRing,
  Forward,
  Pause,
  Play,
  SkipForward,
  Square,
  RotateCw,
  X,
} from "lucide-react";
import ConfirmModal from "./ConfirmModal";
import SequenceStepper, { type StepperStep } from "./SequenceStepper";
import Badge from "./Badge";
import {
  pauseSequence,
  resumeSequence,
  skipStage,
  sendStageNow,
  stopCartRecovery,
  cancelQueuedEmail,
  retryFailedEmail,
  suppressMarketing,
  resubscribeMarketing,
  addNote,
  type ActionResult,
} from "@/app/admin/(dashboard)/customers/actions";

type SequenceId =
  | "cart_recovery"
  | "payment_reminders"
  | "welcome"
  | "post_purchase_review"
  | "replenishment"
  | "winback"
  | "second_purchase";

export interface SequenceCardData {
  id: SequenceId;
  label: string;
  active: boolean;
  paused: boolean;
  context: string | null;
  steps: StepperStep[];
  /** 1-based index of the stage that fires next, if any. */
  nextStage: number | null;
  nextLabel: string | null;
}

interface PendingConfirm {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  tone?: "default" | "danger";
  run: () => Promise<ActionResult>;
}

/** Shared runner: fire a server action, surface its message, keep the UI honest. */
function useAction() {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      try {
        const res = await fn();
        if (res.ok) toast.success(res.message);
        else toast.error(res.message);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Action failed.");
      }
    });
  return { pending, run };
}

function ControlButton({
  onClick,
  icon: Icon,
  children,
  disabled,
  tone = "default",
}: {
  onClick: () => void;
  icon: typeof Pause;
  children: ReactNode;
  disabled?: boolean;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium disabled:opacity-50 ${
        tone === "danger"
          ? "border-red-500/30 bg-red-500/10 text-red-300 hover:border-red-500/60"
          : "border-line bg-surface-2 text-fg-2 hover:border-line-2 hover:text-fg"
      }`}
    >
      <Icon size={13} />
      {children}
    </button>
  );
}

export function SequenceCard({ email, data }: { email: string; data: SequenceCardData }) {
  const { pending, run } = useAction();
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);

  const ask = (c: PendingConfirm) => setConfirm(c);
  const accept = () => {
    if (!confirm) return;
    const fn = confirm.run;
    setConfirm(null);
    run(fn);
  };

  return (
    <div className="admin-card rounded-xl p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-fg">{data.label}</h4>
            {data.paused ? (
              <Badge tone="warn">paused</Badge>
            ) : data.active ? (
              <Badge tone="success">running</Badge>
            ) : (
              <Badge tone="neutral">complete</Badge>
            )}
          </div>
          {data.context && <p className="mt-0.5 text-xs text-muted">{data.context}</p>}
        </div>

        <div className="flex flex-wrap gap-2">
          {data.paused ? (
            <ControlButton
              icon={Play}
              disabled={pending}
              onClick={() =>
                ask({
                  title: `Resume ${data.label}?`,
                  body: (
                    <>
                      Upcoming touches whose windows are still open will resume. Touches whose
                      windows closed during the pause stay missed — they are not replayed.
                    </>
                  ),
                  confirmLabel: "Resume",
                  run: () => resumeSequence(email, data.id),
                })
              }
            >
              Resume
            </ControlButton>
          ) : (
            <ControlButton
              icon={Pause}
              disabled={pending || !data.active}
              onClick={() =>
                ask({
                  title: `Pause ${data.label}?`,
                  body: (
                    <>
                      No further touches will send while paused.{" "}
                      <span className="text-warn">
                        Timing windows keep aging during a pause — a touch whose window closes will
                        be missed, not delayed.
                      </span>
                    </>
                  ),
                  confirmLabel: "Pause sequence",
                  run: () => pauseSequence(email, data.id),
                })
              }
            >
              Pause
            </ControlButton>
          )}

          {data.nextStage != null && (
            <>
              <ControlButton
                icon={Forward}
                disabled={pending}
                onClick={() =>
                  ask({
                    title: `Send ${data.nextLabel} now?`,
                    body: (
                      <>
                        Queues this touch immediately to <strong>{email}</strong>. It reuses the
                        scheduler&apos;s own send key, so the automated sweep cannot send it a second
                        time.
                      </>
                    ),
                    confirmLabel: "Send now",
                    run: () => sendStageNow(email, data.id, data.nextStage as number),
                  })
                }
              >
                Send now
              </ControlButton>
              <ControlButton
                icon={SkipForward}
                disabled={pending}
                onClick={() =>
                  ask({
                    title: `Skip ${data.nextLabel}?`,
                    body: <>This touch will be marked handled and will never send.</>,
                    confirmLabel: "Skip touch",
                    run: () => skipStage(email, data.id, data.nextStage as number),
                  })
                }
              >
                Skip
              </ControlButton>
            </>
          )}

          {data.id === "cart_recovery" && (
            <ControlButton
              icon={Square}
              tone="danger"
              disabled={pending}
              onClick={() =>
                ask({
                  title: "Stop cart recovery?",
                  body: <>Ends recovery for this cart entirely. No further touches will send.</>,
                  confirmLabel: "Stop recovery",
                  tone: "danger",
                  run: () => stopCartRecovery(email),
                })
              }
            >
              Stop
            </ControlButton>
          )}
        </div>
      </div>

      <div className="mt-4">
        <SequenceStepper steps={data.steps} />
      </div>

      <ConfirmModal
        open={confirm !== null}
        title={confirm?.title ?? ""}
        body={confirm?.body}
        confirmLabel={confirm?.confirmLabel ?? "Confirm"}
        tone={confirm?.tone}
        pending={pending}
        onConfirm={accept}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

/** Cancel / retry control rendered inside a journey row. */
export function EmailRowAction({
  id,
  email,
  status,
}: {
  id: string;
  email: string;
  status: "queued" | "failed";
}) {
  const { pending, run } = useAction();
  const [open, setOpen] = useState(false);

  const isCancel = status === "queued";
  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-[11px] text-muted hover:border-line-2 hover:text-fg-2 disabled:opacity-50"
      >
        {isCancel ? <X size={11} /> : <RotateCw size={11} />}
        {isCancel ? "Cancel" : "Retry"}
      </button>
      <ConfirmModal
        open={open}
        title={isCancel ? "Cancel this queued email?" : "Retry this failed email?"}
        body={
          isCancel ? (
            <>It will not be sent when the outbox drains.</>
          ) : (
            <>The send will be attempted again now.</>
          )
        }
        confirmLabel={isCancel ? "Cancel email" : "Retry send"}
        tone={isCancel ? "danger" : "default"}
        pending={pending}
        onConfirm={() => {
          setOpen(false);
          run(() => (isCancel ? cancelQueuedEmail(id, email) : retryFailedEmail(id, email)));
        }}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}

export function MarketingToggle({ email, suppressed }: { email: string; suppressed: boolean }) {
  const { pending, run } = useAction();
  const [open, setOpen] = useState(false);

  return (
    <>
      <ControlButton
        icon={suppressed ? BellRing : BellOff}
        disabled={pending}
        tone={suppressed ? "default" : "danger"}
        onClick={() => setOpen(true)}
      >
        {suppressed ? "Re-enable marketing" : "Suppress marketing"}
      </ControlButton>
      <ConfirmModal
        open={open}
        title={suppressed ? "Re-enable marketing email?" : "Suppress marketing email?"}
        body={
          suppressed ? (
            <>This person will receive lifecycle and recovery email again.</>
          ) : (
            <>
              No marketing or recovery email will be sent.{" "}
              <span className="text-fg-2">
                Transactional email — order confirmations, shipping, refunds, payment instructions —
                still delivers.
              </span>
            </>
          )
        }
        confirmLabel={suppressed ? "Re-enable" : "Suppress"}
        tone={suppressed ? "default" : "danger"}
        pending={pending}
        onConfirm={() => {
          setOpen(false);
          run(() => (suppressed ? resubscribeMarketing(email) : suppressMarketing(email)));
        }}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}

export function NoteComposer({ email }: { email: string }) {
  const { pending, run } = useAction();
  const [value, setValue] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const body = value;
        setValue("");
        run(() => addNote(email, body));
      }}
      className="flex gap-2"
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Add a note…"
        className="flex-1 rounded-lg border border-line bg-ink-2 px-3 py-2 text-sm text-fg outline-none focus:border-accent"
      />
      <button
        type="submit"
        disabled={pending || !value.trim()}
        className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-accent-ink disabled:opacity-50"
      >
        {pending ? "Saving…" : "Add"}
      </button>
    </form>
  );
}
