"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useUI } from "@/lib/ui-context";
import Modal from "./Modal";
import EmailCapture from "./EmailCapture";

/**
 * Exit-intent email capture. Arms after a short dwell, then fires once — on
 * desktop when the cursor leaves the top of the viewport, on touch when the
 * reader scrolls past ~45% of the page. Shows at most once per session
 * (localStorage). Offer: 10% off the first order + restock alerts.
 */
const SEEN_KEY = "ecl_exit_intent_seen";

export default function ExitIntentModal() {
  const pathname = usePathname();
  const { cartOpen } = useUI();
  const transaction = /^\/(checkout|pay|cart|leave-a-review|subscribe|unsubscribe|creators)(\/|$)/.test(pathname);
  const [open, setOpen] = useState(false);
  const [claimed, setClaimed] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || transaction || cartOpen || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    try {
      if (localStorage.getItem(SEEN_KEY)) return;
    } catch {
      return;
    }

    let armed = false;
    const armTimer = setTimeout(() => {
      armed = true;
    }, 30000);

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
      if (e.clientY <= 0 && !e.relatedTarget) trigger();
    };
    function cleanup() {
      clearTimeout(armTimer);
      document.removeEventListener("mouseout", onMouseOut);

    }

    document.addEventListener("mouseout", onMouseOut);

    return cleanup;
  }, [pathname, transaction, cartOpen]);

  if (!open || transaction || cartOpen) return null;

  return (
    <Modal open={open} onClose={() => setOpen(false)} label="First order offer" className="w-full max-w-md overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
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
              <p role="status" className="text-sm text-muted">{claimed}</p>
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
                onDone={setClaimed}
              />
              <p className="mt-3 text-center text-[11px] text-muted-2">
                No spam. Unsubscribe anytime. Research use only.
              </p>
            </>
          )}
        </div>
    </Modal>
  );
}
