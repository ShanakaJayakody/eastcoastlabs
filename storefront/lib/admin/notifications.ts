/**
 * Back-in-stock automation — the storefront has been collecting these emails
 * (stock_notifications) with nothing to trigger them. A restock now queues them.
 *
 * Atomic claim: the UPDATE...RETURNING below claims (flips notified=true) and
 * reads the rows in ONE statement, not a select-then-loop-then-update. The old
 * three-step version had a real race (a second restock landing between the
 * select and the update would re-queue the same waiting shopper) — SystemsThinking
 * review surfaced this pattern; fixed here rather than only in the new
 * abandoned-cart code that would otherwise have copied it.
 */
import { adminDb } from "./db";
import { queueEmail } from "./email";
import { unsubscribeUrl } from "@/lib/email/unsubscribe";

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

  // Atomic claim: flips notified=true and returns the claimed rows in one round
  // trip, so a concurrent restock can never see (and re-queue) the same rows.
  const { data: claimed } = await db
    .from("stock_notifications")
    .update({ notified: true })
    .eq("product_slug", product.slug)
    .eq("notified", false)
    .select("id, email");

  const rows = claimed ?? [];
  if (!rows.length) return 0;

  // A restock alert is a commercial message, so it carries an unsubscribe link
  // like every other marketing send. Shoppers who opted out are skipped even
  // though they're on the waitlist — the opt-out is the later, stronger signal.
  const { data: unsubRows } = await db
    .from("subscribers")
    .select("email")
    .in("email", rows.map((r) => r.email as string))
    .not("unsubscribed_at", "is", null);
  const suppressed = new Set((unsubRows ?? []).map((r) => (r as { email: string }).email));

  let queued = 0;
  for (const row of rows) {
    const email = row.email as string;
    if (suppressed.has(email)) continue;
    const unsub = unsubscribeUrl(email);
    if (!unsub) {
      console.error("queueBackInStock: no unsubscribe secret configured — restock alerts skipped");
      break;
    }
    await queueEmail({
      to: email,
      template: "back_in_stock",
      payload: {
        product_name: product.name,
        product_slug: product.slug,
        variant_label: (variant as unknown as { label: string }).label,
        url: `/product/${product.slug}`,
        unsubscribe_url: unsub,
      },
      relatedType: "product_variant",
      relatedId: variantId,
    });
    queued++;
  }

  return queued;
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
