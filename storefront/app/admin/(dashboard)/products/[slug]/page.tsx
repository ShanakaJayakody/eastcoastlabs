import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { getProductBySlug, variantMovements, type MovementRow } from "@/lib/admin/products";
import { waitlistCount } from "@/lib/admin/notifications";
import ProductEditor from "@/components/admin/ProductEditor";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireAdmin();
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const [movementLists, waitlist] = await Promise.all([
    Promise.all(product.variants.map((v) => variantMovements(v.id))),
    waitlistCount(slug),
  ]);
  const movements: Record<string, MovementRow[]> = Object.fromEntries(
    product.variants.map((v, i) => [v.id, movementLists[i]]),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/products" className="rounded-md p-1 text-muted hover:text-fg">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h2 className="text-lg font-semibold text-fg">{product.name}</h2>
          <p className="font-mono text-xs text-muted">{product.slug}</p>
        </div>
      </div>

      <ProductEditor product={product} movements={movements} waitlist={waitlist} />
    </div>
  );
}
