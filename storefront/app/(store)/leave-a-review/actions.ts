"use server";

// A review link proves mailbox access without exposing email or sequential IDs.
import { verifyOrderAccessToken } from "@/lib/order-access";
import { supabaseAdmin } from "@/lib/supabase";

export interface OrderProduct {
  slug: string;
  name: string;
}

export interface LookupResult {
  ok: boolean;
  error?: string;
  products?: OrderProduct[];
}

interface OrderRow {
  id: string;
  status: string;
  order_items: { product_slug: string; product_name: string }[];
}

async function findReviewableOrder(token: string): Promise<{ order: OrderRow } | { error: string }> {
  const id = verifyOrderAccessToken(token, "review");
  if (!id) return { error: "Open the secure review link in your latest review email. If it has expired, contact us for help." };
  const db = supabaseAdmin();
  if (!db) return { error: "Reviews are temporarily unavailable — please try again later." };
  const { data, error } = await db.from("orders")
    .select("id, status, order_items(product_slug, product_name)").eq("id", id).maybeSingle();
  const order = data as OrderRow | null;
  if (error || !order) return { error: "This order is temporarily unavailable. Please try again later." };
  if (!["shipped", "completed"].includes(order.status)) {
    return { error: "Reviews open once your order has shipped." };
  }

  const { data: existing, error: reviewError } = await db
    .from("reviews")
    .select("id")
    .eq("order_id", order.id)
    .maybeSingle();
  if (reviewError) return { error: "Reviews are temporarily unavailable. Please try again later." };
  if (existing) {
    return { error: "A review for this order has already been submitted — thank you!" };
  }
  return { order };
}

/**
 * Slugs the review form should not offer. Syringes and swabs are stock a
 * researcher consumes, not a product they have an opinion about — listing them
 * beside the peptide only invites a review that helps nobody. Falls open: if the
 * lookup fails we offer everything rather than blocking the review.
 */
async function accessorySlugs(): Promise<Set<string>> {
  const db = supabaseAdmin();
  if (!db) return new Set();
  const { data } = await db.from("products").select("slug").contains("categories", ["accessory"]);
  return new Set((data ?? []).map((p) => (p as { slug: string }).slug));
}

export async function lookupOrder(token: string): Promise<LookupResult> {
  const result = await findReviewableOrder(token);
  if ("error" in result) return { ok: false, error: result.error };

  const accessories = await accessorySlugs();
  const seen = new Map<string, string>();
  for (const item of result.order.order_items) {
    if (accessories.has(item.product_slug)) continue;
    if (!seen.has(item.product_slug)) seen.set(item.product_slug, item.product_name);
  }
  if (!seen.size) {
    return { ok: false, error: "This order doesn't have anything we collect reviews for." };
  }
  return {
    ok: true,
    products: [...seen.entries()].map(([slug, name]) => ({ slug, name })),
  };
}

export interface SubmitInput {
  token: string;
  productSlug: string;
  author: string;
  rating: number;
  title: string;
  body: string;
}

export async function submitReview(input: SubmitInput): Promise<{ ok: boolean; error?: string }> {
  if (!input || typeof input.token !== "string" || ![input.author,input.title,input.body,input.productSlug].every((v) => typeof v === "string")) return { ok:false,error:"Please complete the review fields." };
  const result = await findReviewableOrder(input.token);
  if ("error" in result) return { ok: false, error: result.error };
  const { order } = result;

  const author = input.author.trim();
  const title = input.title.trim();
  const body = input.body.trim();
  const rating = input.rating;

  if (!order.order_items.some((i) => i.product_slug === input.productSlug)) {
    return { ok: false, error: "Pick one of the products from your order." };
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { ok: false, error: "Pick a rating from 1 to 5." };
  }
  if (author.length < 2 || author.length > 80) {
    return { ok: false, error: "Add a display name (2–80 characters)." };
  }
  if (title.length < 3 || title.length > 120) {
    return { ok: false, error: "Add a short title (3–120 characters)." };
  }
  if (body.length < 10 || body.length > 2000) {
    return { ok: false, error: "Tell us a little more (at least 10 characters)." };
  }

  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "Reviews are temporarily unavailable — please try again later." };

  const { error } = await db.from("reviews").insert({
    product_slug: input.productSlug,
    author,
    rating,
    title,
    body,
    verified: true,
    status: "pending",
    order_id: order.id,
  });
  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "A review for this order has already been submitted — thank you!" };
    }
    console.error("[leave-a-review] insert failed");
    return { ok: false, error: "Something went wrong saving your review — please try again." };
  }
  return { ok: true };
}
