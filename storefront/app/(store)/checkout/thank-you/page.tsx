import type { Metadata } from "next";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import { formatAud } from "@/lib/format";
import { instructionsForOrder, isPaymentMethod, referenceForOrderNumber } from "@/lib/payments";
import PaymentInstructionsPanel from "@/components/PaymentInstructions";

export const metadata: Metadata = {
  title: "Order confirmed",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface OrderItemRow {
  product_name: string | null;
  variant_label: string | null;
  qty: number;
  line_total_cents: number;
}

const cents = (c: number) => formatAud(c / 100);

export default async function ThankYouPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order: orderNumber } = await searchParams;
  const db = supabaseAdmin();

  const order =
    orderNumber && db
      ? (
          await db
            .from("orders")
            .select(
              "id, order_number, customer_email, total_cents, status, payment_method, payment_reference, payment_expires_at",
            )
            .eq("order_number", orderNumber)
            .maybeSingle()
        ).data
      : null;

  const items: OrderItemRow[] =
    order && db
      ? ((
          await db
            .from("order_items")
            .select("product_name, variant_label, qty, line_total_cents")
            .eq("order_id", order.id)
        ).data as OrderItemRow[]) ?? []
      : [];

  if (!order) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-fg">Order not found</h1>
        <p className="mt-2 text-sm text-muted">
          We couldn&apos;t find that order reference. If you just checked out, check your
          email for confirmation.
        </p>
        <Link
          href="/shop"
          className="mt-6 inline-block rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink"
        >
          Back to shop
        </Link>
      </div>
    );
  }

  // Payment details belong here, not in a follow-up email: this is the moment
  // the customer is holding their phone and can transfer immediately. The email
  // repeats them for later.
  const isPending = order.status === "pending";
  const method = isPaymentMethod(order.payment_method) ? order.payment_method : "bank_transfer";
  const reference = order.payment_reference ?? referenceForOrderNumber(order.order_number);
  const instructions = isPending
    ? await instructionsForOrder({ method, reference, amountCents: order.total_cents })
    : null;

  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-success/40 bg-success/10 text-xl text-success">
          ✓
        </div>
        <h1 className="text-2xl font-bold text-fg">Thanks — your order is reserved</h1>
        <p className="mt-2 text-sm text-muted">
          Order <span className="font-mono text-fg-2">{order.order_number}</span> · details also
          sent to {order.customer_email}
        </p>
      </div>

      {isPending && (
        <div className="mt-8">
          {instructions ? (
            <>
              <PaymentInstructionsPanel instructions={instructions} />
              <div className="mt-3 text-center">
                <Link
                  href={`/pay/${order.id}`}
                  className="text-sm text-accent-2 underline underline-offset-2"
                >
                  Open your payment page →
                </Link>
                <p className="mt-1 text-xs text-muted-2">
                  Bookmark it — it confirms itself the moment your transfer lands.
                </p>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-line bg-surface p-5 text-sm text-fg-2">
              We&apos;re finalising the payment details for this order and will email them to you
              shortly.
            </div>
          )}
        </div>
      )}

      <div className="mt-8 rounded-xl border border-line bg-surface p-5">
        <ul className="space-y-3 text-sm">
          {items.map((it: OrderItemRow, i: number) => (
            <li key={i} className="flex justify-between gap-3">
              <span className="text-fg-2">
                {it.product_name}
                <span className="block text-xs text-muted">
                  {it.variant_label} × {it.qty}
                </span>
              </span>
              <span className="text-fg-2">{cents(it.line_total_cents)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-between border-t border-line pt-4 text-base">
          <span className="font-semibold text-fg">Total</span>
          <span className="font-semibold text-fg">{cents(order.total_cents)}</span>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-line bg-ink-2 p-5 text-sm">
        <h2 className="font-semibold text-fg">What happens next</h2>
        <ol className="mt-2 space-y-1.5 text-muted">
          <li>
            1. Transfer {cents(order.total_cents)} using the reference{" "}
            <span className="font-mono text-fg-2">{reference}</span>.
          </li>
          <li>2. We confirm your payment — usually within a few hours.</li>
          <li>3. We pack and dispatch your order, then email your tracking number.</li>
        </ol>
      </div>

      <div className="mt-8 text-center">
        <Link href="/shop" className="text-sm text-accent-2 underline underline-offset-2">
          Continue browsing
        </Link>
      </div>
    </div>
  );
}
