import { notFound, redirect } from "next/navigation";
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
  const session = await requireAdmin();
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  // Stock lives only on the 1-vial pool, so that's the only ledger worth
  // loading — the old page fetched one query per tier to show the same rows.
  const pool = product.variants.find((v) => v.pack_size === 1) ?? null;

  const [movements, waitlist, all] = await Promise.all([
    pool ? variantMovements(pool.id, 20, true) : Promise.resolve([] as MovementRow[]),
    waitlistCount(slug),
    listProducts(),
  ]);
  if(product.size_parent_id){
    const parent=all.find(p=>p.id===product.size_parent_id);
    if(parent)redirect(`/admin/products/${parent.slug}#sizes`);
    notFound();
  }
  const sizes = [product,...all.filter(p=>p.size_parent_id===product.id)];
  const parents = all.filter(p=>!p.size_parent_id);

  // Prev/next follow the same name order as the products list, so stepping
  // through the catalogue matches what the operator just saw.
  const idx = parents.findIndex((p) => p.slug === slug);
  const at = (i: number): ProductNeighbour | null =>
    i >= 0 && i < parents.length ? { slug: parents[i].slug, name: parents[i].name } : null;

  return (
    <ProductEditor key={product.id}
      product={product}
      adminName={session.name}
      sizes={sizes}
      movements={movements}
      waitlist={waitlist}
      prev={idx > 0 ? at(idx - 1) : null}
      next={idx >= 0 ? at(idx + 1) : null}
    />
  );
}
