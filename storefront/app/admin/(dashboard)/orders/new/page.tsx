import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { listProducts } from "@/lib/admin/products";
import ManualOrderForm, { type VariantOption } from "@/components/admin/ManualOrderForm";

export const dynamic = "force-dynamic";

export default async function NewOrderPage() {
  await requireAdmin();
  const products = await listProducts();
  const variants: VariantOption[] = products.flatMap((p) =>
    p.variants.map((v) => ({
      id: v.id,
      label: `${p.name} · ${v.label} (${v.sku})`,
      priceCents: v.price_cents,
      available: v.available,
    })),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/orders" className="rounded-md p-1 text-muted hover:text-fg">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h2 className="text-lg font-semibold text-fg">New manual order</h2>
          <p className="text-xs text-muted">
            For phone or bank-transfer orders. Prices and stock come from the same server path as
            the storefront.
          </p>
        </div>
      </div>
      <ManualOrderForm variants={variants} />
    </div>
  );
}
