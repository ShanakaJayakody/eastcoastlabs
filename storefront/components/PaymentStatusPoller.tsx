"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getOrderPaymentStatus } from "@/app/(store)/pay/actions";

/**
 * Polls an order's payment status while the customer is looking at the page.
 *
 * The moment a transfer is confirmed, the page flips to "Payment confirmed"
 * without the customer refreshing or wondering whether it worked. That gap —
 * "I've sent the money, did it arrive?" — is where card-less checkouts generate
 * their support tickets.
 *
 * Backs off as time passes: a payment made in the first minute is worth
 * catching quickly; an hour later, once every 30s is plenty.
 */
export default function PaymentStatusPoller({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    const startedAt = Date.now();

    const intervalFor = (elapsedMs: number) =>
      elapsedMs < 2 * 60_000 ? 5_000 : elapsedMs < 10 * 60_000 ? 15_000 : 30_000;

    async function tick() {
      if (cancelled || document.hidden) {
        schedule();
        return;
      }
      try {
        const status = await getOrderPaymentStatus(orderId);
        if (!cancelled && status && status !== "pending") {
          // Server component re-renders with the confirmed state.
          router.refresh();
          return;
        }
      } catch {
        // A failed poll is not worth surfacing — the next one will try again.
      }
      schedule();
    }

    function schedule() {
      if (cancelled) return;
      timer = window.setTimeout(tick, intervalFor(Date.now() - startedAt));
    }

    schedule();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [orderId, router]);

  return (
    <div className="mt-4 flex items-center gap-2 rounded-lg border border-line bg-ink-2 px-3 py-2 text-xs text-muted">
      <span className="relative flex h-2 w-2" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
      </span>
      <span>
        This page updates on its own — leave it open and it&apos;ll confirm the moment your transfer
        lands.
      </span>
      <button
        type="button"
        onClick={() => {
          setChecking(true);
          router.refresh();
          window.setTimeout(() => setChecking(false), 1200);
        }}
        className="ml-auto shrink-0 rounded-md border border-line-2 px-2 py-1 font-medium text-fg-2 transition hover:border-accent hover:text-accent"
      >
        {checking ? "Checking…" : "Check now"}
      </button>
    </div>
  );
}
