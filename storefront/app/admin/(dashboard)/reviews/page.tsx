import { requireAdmin } from "@/lib/admin/auth";
import { adminDb } from "@/lib/admin/db";
import ReviewModeration, { type ReviewRow } from "@/components/admin/ReviewModeration";

export const dynamic = "force-dynamic";

export default async function ReviewsPage() {
  await requireAdmin();
  const db = adminDb();

  const [{ data: reviews }, { data: products }] = await Promise.all([
    db.from("reviews").select("*").order("created_at", { ascending: false }),
    db.from("products").select("slug, name").order("name"),
  ]);

  return (
    <ReviewModeration
      reviews={(reviews ?? []) as ReviewRow[]}
      productSlugs={(products ?? []) as { slug: string; name: string }[]}
    />
  );
}
