/**
 * Back-in-stock automation — the storefront has been collecting these emails
 * (stock_notifications) with nothing to trigger them. A restock now queues them.
 *
 * Idempotent: rows are flipped to notified=true as they're queued, so a second
 * restock of the same variant never re-emails the same person.
 */
import { adminDb } from "./db";
import { queueEmail } from "./email";

export async function queueBackInStock(variantId: string): Promise<number> {
  const db = adminDb();

  // Which product does this variant belong to?
  const { data: variant } = await db
    .from("product_variants")
    .select("sku, label, products!inner(slug, name)")
    .eq("id", variantId)
    .maybeSingle();
  if (!variant) return 0;

  const product = (variant as unknown as { products: { slug: string; name: string } }).products;

  const { data: waiting } = await db
    .from("stock_notifications")
    .select("id, email")
    .eq("product_slug", product.slug)
    .eq("notified", false);

  const rows = waiting ?? [];
  if (!rows.length) return 0;

  for (const row of rows) {
    await queueEmail({
      to: row.email as string,
      template: "back_in_stock",
      payload: {
        product_name: product.name,
        product_slug: product.slug,
        variant_label: (variant as unknown as { label: string }).label,
        url: `/product/${product.slug}`,
      },
      relatedType: "product_variant",
      relatedId: variantId,
    });
    await db.from("stock_notifications").update({ notified: true }).eq("id", row.id as string);
  }

  return rows.length;
}

/** How many shoppers are waiting on a given product slug. */
export async function waitlistCount(productSlug: string): Promise<number> {
  const { count } = await adminDb()
    .from("stock_notifications")
    .select("*", { count: "exact", head: true })
    .eq("product_slug", productSlug)
    .eq("notified", false);
  return count ?? 0;
}
