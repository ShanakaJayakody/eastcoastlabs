import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import {
  getProductBySlug,
  listProducts,
  variantMovements,
  type MovementRow,
} from "@/lib/admin/products";
import { waitlistCount } from "@/lib/admin/notifications";
import ProductEditor, { type ProductNeighbour } from "@/components/admin/ProductEditor";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireAdmin();
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  // Stock lives only on the 1-vial pool, so that's the only ledger worth
  // loading — the old page fetched one query per tier to show the same rows.
  const pool = product.variants.find((v) => v.pack_size === 1) ?? null;

  const [movements, waitlist, all] = await Promise.all([
    pool ? variantMovements(pool.id) : Promise.resolve([] as MovementRow[]),
    waitlistCount(slug),
    listProducts(),
  ]);

  // Prev/next follow the same name order as the products list, so stepping
  // through the catalogue matches what the operator just saw.
  const idx = all.findIndex((p) => p.slug === slug);
  const at = (i: number): ProductNeighbour | null =>
    i >= 0 && i < all.length ? { slug: all[i].slug, name: all[i].name } : null;

  return (
    <ProductEditor
      product={product}
      movements={movements}
      waitlist={waitlist}
      prev={idx > 0 ? at(idx - 1) : null}
      next={idx >= 0 ? at(idx + 1) : null}
    />
  );
}
