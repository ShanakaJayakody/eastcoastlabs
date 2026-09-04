import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { getOrder } from "@/lib/admin/order-queries";
import { packQueuePosition } from "@/lib/admin/packing";
import PackingMode from "@/components/admin/PackingMode";

export const metadata: Metadata = { title: "Packing — ECL Admin" };
export const dynamic = "force-dynamic";

export default async function PackPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const [order, position] = await Promise.all([getOrder(id), packQueuePosition(id)]);
  if (!order) notFound();

  // Already shipped, cancelled or refunded: say so and offer the queue rather
  // than presenting a checklist for work that is done.
  const packable = order.status === "paid" || order.status === "processing";
  if (!packable) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-12 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
          <CheckCircle2 size={22} />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-fg">
            #{order.order_number} is already {order.status}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {position.total > 0
              ? `${position.total} other order${position.total === 1 ? "" : "s"} still to pack.`
              : "Nothing left in the packing queue."}
          </p>
        </div>
        <div className="flex justify-center gap-2">
          {position.nextId && (
            <Link
              href={`/admin/orders/${position.nextId}/pack`}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:brightness-95"
            >
              Pack the next one
            </Link>
          )}
          <Link
            href={`/admin/orders/${order.id}`}
            className="rounded-lg border border-line-2 px-4 py-2 text-sm text-fg-2 hover:text-fg"
          >
            View order
          </Link>
        </div>
      </div>
    );
  }

  return (
    <PackingMode
      order={{
        id: order.id,
        orderNumber: order.order_number,
        customerName: order.customer_name,
        customerEmail: order.customer_email,
        address: order.shipping_address,
        totalCents: order.total_cents,
        notes: order.notes,
        items: order.items.map((i) => ({
          id: i.id,
          productName: i.product_name,
          variantLabel: i.variant_label,
          sku: i.sku,
          qty: i.qty,
          refundedQty: i.refunded_qty,
          lineTotalCents: i.line_total_cents,
        })),
      }}
      nextId={position.nextId}
      position={position.index >= 0 ? position.index + 1 : 0}
      positionUnknown={position.truncated && position.index < 0}
      total={position.total}
    />
  );
}
