"use client";

import { useState } from "react";

/**
 * Reusable email-capture form. Posts to /api/subscribe with a `source` tag so
 * newsletter / exit-intent / back-in-stock all funnel through one seam. Shows
 * inline success/error; optional onDone fires after a successful subscribe.
 */
export default function EmailCapture({
  source,
  cta = "Notify me",
  placeholder = "you@lab.com",
  successMsg = "✓ You're on the list.",
  onDone,
}: {
  source: string;
  cta?: string;
  placeholder?: string;
  successMsg?: string;
  onDone?: (message: string) => void;
}) {
  const [message, setMessage] = useState(successMsg);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (state === "loading") return;
    setState("loading");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        const confirmedMessage = typeof json.message === "string" ? json.message : source.startsWith("back_in_stock:") ? "Notification requested. We’ll email you when it is available." : "Check your email to confirm your subscription.";
        setMessage(confirmedMessage);
        setState("done");
        onDone?.(confirmedMessage);
      } else {
        setState("error");
      }
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return <p role="status" className="text-sm font-medium text-success">{message}</p>;
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap gap-2">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={placeholder}
        aria-label="Email address"
        className="min-w-0 flex-1 rounded-lg border border-line bg-ink px-3.5 py-2.5 text-sm text-fg outline-none transition focus:border-accent"
      />
      <button
        type="submit"
        disabled={state === "loading"}
        className="btn-press shrink-0 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink transition hover:brightness-95 disabled:opacity-60"
      >
        {state === "loading" ? "…" : cta}
      </button>
      {state === "error" && (
        <p role="alert" className="w-full text-xs text-warn">Something went wrong — try again.</p>
      )}
    </form>
  );
}
