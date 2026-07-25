"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { adminDb } from "@/lib/admin/db";
import { logAudit } from "@/lib/admin/audit";

export interface ActionResult {
  ok: boolean;
  error?: string;
  message?: string;
}

type Status = "pending" | "published" | "rejected";

/** Moderate a review. Publishing is the only path to shopper visibility. */
export async function setReviewStatus(id: string, status: Status): Promise<ActionResult> {
  const session = await requireAdmin();
  try {
    const db = adminDb();
    const { data: before } = await db
      .from("reviews")
      .select("product_slug, status, author")
      .eq("id", id)
      .maybeSingle();

    const { error } = await db.from("reviews").update({ status }).eq("id", id);
    if (error) throw new Error(error.message);

    await logAudit({
      actor: session.email,
      action: `review.${status}`,
      entityType: "review",
      entityId: id,
      diff: { before: before?.status ?? null, after: status },
    });

    revalidatePath("/admin/reviews");
    revalidatePath("/admin");
    if (before?.product_slug) revalidatePath(`/product/${before.product_slug}`);
    return { ok: true, message: status === "published" ? "Review published" : `Review ${status}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Add a review manually (e.g. transcribing one emailed in). Published on save. */
export async function createReview(input: {
  productSlug: string;
  author: string;
  location?: string;
  rating: number;
  title: string;
  body: string;
  verified: boolean;
}): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!input.productSlug || !input.author.trim() || !input.title.trim() || !input.body.trim())
    return { ok: false, error: "Product, author, title and body are required." };
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5)
    return { ok: false, error: "Rating must be 1–5." };
  try {
    const db = adminDb();
    const { error } = await db.from("reviews").insert({
      product_slug: input.productSlug,
      author: input.author.trim(),
      location: input.location?.trim() || null,
      rating: input.rating,
      title: input.title.trim(),
      body: input.body.trim(),
      verified: input.verified,
      status: "published",
      is_sample: false,
    });
    if (error) throw new Error(error.message);
    await logAudit({
      actor: session.email,
      action: "review.create",
      entityType: "review",
      entityId: input.productSlug,
      diff: { author: input.author, rating: input.rating },
    });
    revalidatePath("/admin/reviews");
    revalidatePath(`/product/${input.productSlug}`);
    return { ok: true, message: "Review added and published" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Purge the seeded sample reviews, if any were ever loaded into the table. */
export async function deleteSampleReviews(): Promise<ActionResult> {
  const session = await requireAdmin();
  try {
    const db = adminDb();
    const { error } = await db.from("reviews").delete().eq("is_sample", true);
    if (error) throw new Error(error.message);
    await logAudit({ actor: session.email, action: "review.purge_samples", entityType: "review" });
    revalidatePath("/admin/reviews");
    return { ok: true, message: "Sample reviews removed" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
