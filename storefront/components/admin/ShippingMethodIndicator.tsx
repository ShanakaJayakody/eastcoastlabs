import { Truck } from "lucide-react";
import type { OrderShippingMethod } from "@/lib/admin/order-shipping";

/** Shared by order review and packing so every fulfilment entry point agrees. */
export default function ShippingMethodIndicator({
  method,
  compact = false,
}: {
  method: OrderShippingMethod;
  compact?: boolean;
}) {
  const tone = method.id === "express"
    ? "border-warn/60 bg-warn/10 text-warn"
    : "border-accent/40 bg-accent/10 text-accent-2";

  if (compact) {
    return <span className={`inline-block rounded-md border px-2 py-1 text-xs font-bold tracking-wide ${tone}`}>
      {method.label}
    </span>;
  }

  return (
    <section aria-label="Shipping method" className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 ${tone}`}>
      <Truck aria-hidden="true" className="shrink-0" size={24} strokeWidth={2.5} />
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest opacity-80">Shipping method</p>
        <p className="text-lg font-black tracking-wide">{method.label}</p>
      </div>
    </section>
  );
}
