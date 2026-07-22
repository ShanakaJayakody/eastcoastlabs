"use client";

import { useEffect, useState } from "react";
import EmailCapture from "./EmailCapture";

/**
 * Exit-intent email capture. Arms after a short dwell, then fires once — on
 * desktop when the cursor leaves the top of the viewport, on touch when the
 * reader scrolls past ~45% of the page. Shows at most once per session
 * (localStorage). Offer: 10% off the first order + restock alerts.
 */
const SEEN_KEY = "ecl_exit_intent_seen";

export default function ExitIntentModal() {
  const [open, setOpen] = useState(false);
  const [claimed, setClaimed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (localStorage.getItem(SEEN_KEY)) return;
    } catch {
      return;
    }

    let armed = false;
    const armTimer = setTimeout(() => {
      armed = true;
    }, 6000);

    const trigger = () => {
      if (!armed) return;
      setOpen(true);
      try {
        localStorage.setItem(SEEN_KEY, "1");
      } catch {
        /* ignore */
      }
      cleanup();
    };

    const onMouseOut = (e: MouseEvent) => {
      if (e.clientY <= 0) trigger();
    };
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max > 0 && window.scrollY / max > 0.45) trigger();
    };

    function cleanup() {
      clearTimeout(armTimer);
      document.removeEventListener("mouseout", onMouseOut);
      window.removeEventListener("scroll", onScroll);
    }

    document.addEventListener("mouseout", onMouseOut);
    window.addEventListener("scroll", onScroll, { passive: true });
    return cleanup;
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />
      <div className="animate-in relative w-full max-w-md overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-md text-muted transition hover:text-fg"
          aria-label="Close"
        >
          ✕
        </button>

        {/* Accent header */}
        <div className="border-b border-line bg-gradient-to-br from-accent/15 to-transparent px-6 py-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">First order</p>
          <p className="mt-2 text-3xl font-bold text-fg">Save 10%</p>
          <p className="mt-1 text-sm text-muted">
            Join the list for your code, plus restock alerts and new-compound drops.
          </p>
        </div>

        <div className="px-6 py-6">
          {claimed ? (
            <div className="text-center">
              <p className="text-sm text-muted">Your code — use it at checkout:</p>
              <p className="mt-2 rounded-lg border border-dashed border-accent/50 bg-accent/10 py-3 text-center text-lg font-bold tracking-widest text-accent">
                WELCOME10
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn-press mt-4 w-full rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink hover:brightness-95"
              >
                Start shopping
              </button>
            </div>
          ) : (
            <>
              <EmailCapture
                source="exit_intent"
                cta="Get my 10% code"
                successMsg=""
                onDone={() => setClaimed(true)}
              />
              <p className="mt-3 text-center text-[11px] text-muted-2">
                No spam. Unsubscribe anytime. Research use only.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
