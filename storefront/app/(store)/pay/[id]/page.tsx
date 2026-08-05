import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import { formatAud } from "@/lib/format";
import { instructionsForOrder, isPaymentMethod, referenceForOrderNumber } from "@/lib/payments";
import PaymentInstructionsPanel from "@/components/PaymentInstructions";
import PaymentStatusPoller from "@/components/PaymentStatusPoller";

export const metadata: Metadata = {
  title: "Complete your payment",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * The persistent payment page.
 *
 * With customer-initiated payment there is a gap — minutes to days — between
 * placing an order and the money arriving. Every email in that window links
 * here, so there is always one URL that answers "what do I owe, how do I pay
 * it, and has it landed yet?" The page polls its own status, so a customer who
 * leaves it open sees it flip to confirmed without refreshing.
 *
 * Addressed by order UUID rather than order number: the number is sequential
 * and guessable, and this page shows an email address and an amount.
 */

const cents = (c: number) => formatAud(c / 100);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface OrderItemRow {
  product_name: string | null;
  variant_label: string | null;
  qty: number;
  line_total_cents: number;
}

export default async function PayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const db = supabaseAdmin();
  if (!db) notFound();

  const { data: order } = await db
    .from("orders")
    .select(
      "id, order_number, status, customer_email, total_cents, payment_method, payment_reference, payment_expires_at, paid_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (!order) notFound();

  const { data: itemRows } = await db
    .from("order_items")
    .select("product_name, variant_label, qty, line_total_cents")
    .eq("order_id", order.id);
  const items = (itemRows as OrderItemRow[]) ?? [];

  const isPending = order.status === "pending";
  const isCancelled = order.status === "cancelled";

  const method = isPaymentMethod(order.payment_method) ? order.payment_method : "bank_transfer";
  const reference = order.payment_reference ?? referenceForOrderNumber(order.order_number);
  const instructions = isPending
    ? await instructionsForOrder({ method, reference, amountCents: order.total_cents })
    : null;

  const expiresAt = order.payment_expires_at ? new Date(order.payment_expires_at) : null;
  const hoursLeft = expiresAt
    ? Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / 3600_000))
    : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-14">
      {/* ---- Status header ---- */}
      {isPending ? (
        <>
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-full border border-warn/40 bg-warn/10 text-sm text-warn">
              ⏳
            </span>
            <div>
              <h1 className="text-xl font-bold text-fg">Waiting for your payment</h1>
              <p className="text-sm text-muted">
                Order <span className="font-mono text-fg-2">{order.order_number}</span>
                {hoursLeft !== null && (
                  <> · held for about {hoursLeft} more {hoursLeft === 1 ? "hour" : "hours"}</>
                )}
              </p>
            </div>
          </div>
          <PaymentStatusPoller orderId={order.id} />
        </>
      ) : isCancelled ? (
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-full border border-line-2 bg-surface text-sm text-muted">
            ×
          </span>
          <div>
            <h1 className="text-xl font-bold text-fg">This order was released</h1>
            <p className="text-sm text-muted">
              Order <span className="font-mono text-fg-2">{order.order_number}</span> · nothing was
              charged
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-full border border-success/40 bg-success/10 text-sm text-success">
            ✓
          </span>
          <div>
            <h1 className="text-xl font-bold text-fg">Payment confirmed</h1>
            <p className="text-sm text-muted">
              Order <span className="font-mono text-fg-2">{order.order_number}</span> · we&apos;re
              packing it now
            </p>
          </div>
        </div>
      )}

      {/* ---- Payment details (pending only) ---- */}
      {isPending && (
        <div className="mt-6">
          {instructions ? (
            <PaymentInstructionsPanel instructions={instructions} />
          ) : (
            <div className="rounded-xl border border-line bg-surface p-5 text-sm text-fg-2">
              We&apos;re finalising the payment details for this order — reply to your confirmation
              email and we&apos;ll send them straight through.
            </div>
          )}
        </div>
      )}

      {/* ---- Order summary ---- */}
      <div className="mt-6 rounded-xl border border-line bg-surface p-5">
        <h2 className="mb-3 text-sm font-semibold text-fg">Your order</h2>
        <ul className="space-y-2.5 text-sm">
          {items.map((it, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span className="text-fg-2">
                {it.product_name}
                <span className="block text-xs text-muted">
                  {it.variant_label} × {it.qty}
                </span>
              </span>
              <span className="shrink-0 text-fg-2">{cents(it.line_total_cents)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-between border-t border-line pt-4 text-base">
          <span className="font-semibold text-fg">
            {isPending ? "Amount to transfer" : "Total"}
          </span>
          <span className="font-semibold text-fg">{cents(order.total_cents)}</span>
        </div>
      </div>

      {isCancelled && (
        <div className="mt-6 text-center">
          <Link
            href="/shop"
            className="inline-block rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink"
          >
            Back to the shop
          </Link>
        </div>
      )}

      <p className="mt-8 text-center text-xs text-muted-2">
        Questions about this order? Reply to your confirmation email — we answer within one business
        day. Research use only.
      </p>
    </div>
  );
}
