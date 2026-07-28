"use client";

import { useState } from "react";

/**
 * Minimal single-field subscribe for the dossier "Correspondence" column —
 * underlined input, no rounded card. Posts to the same /api/subscribe seam
 * every other capture form on the site uses.
 */
export default function DispatchSubscribe() {
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
        body: JSON.stringify({ email, source: "variant_v2_dispatch" }),
      });
      const json = await res.json();
      setState(json.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return <p className="font-data text-[13px] text-accent">✓ You're on the list.</p>;
  }

  return (
    <form onSubmit={submit} className="flex items-end gap-3">
      <div className="flex-1 border-b border-line-2 pb-1.5">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@lab.com"
          className="w-full bg-transparent text-sm text-fg placeholder:text-muted-2 focus:outline-none"
        />
      </div>
      <button
        type="submit"
        disabled={state === "loading"}
        className="shrink-0 font-data text-[12px] uppercase tracking-wide text-accent underline underline-offset-2 disabled:opacity-50"
      >
        {state === "loading" ? "Sending…" : "Subscribe"}
      </button>
      {state === "error" && <p className="mt-1 text-[11px] text-warn">Something went wrong.</p>}
    </form>
  );
}
