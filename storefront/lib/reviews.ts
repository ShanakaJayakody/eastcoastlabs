import "server-only";

/**
 * Reviews data layer — SUPABASE-BACKED (sample JSON retired).
 *
 * Only rows with status='published' are ever returned, so the moderation queue at
 * /admin/reviews is the single gate between a submitted review and a shopper
 * seeing it. When a product has no published reviews we return null and the UI
 * omits ratings entirely — we never synthesise social proof.
 *
 * Server-only: every consumer (PDP, product cards, home) is a server component.
 */
import { cache } from "react";
import { supabaseAdmin } from "./supabase";

export interface Review {
  author: string;
  location?: string;
  rating: number;
  date: string; // ISO yyyy-mm-dd
  verified: boolean;
  title: string;
  body: string;
}

export interface ProductReviews {
  rating: number; // aggregate 0..5
  count: number;
  reviews: Review[];
}

interface Row {
  product_slug: string;
  author: string;
  location: string | null;
  rating: number;
  title: string;
  body: string;
  verified: boolean;
  created_at: string;
}


/**
 * Retired: the storefront no longer renders placeholder reviews, so nothing needs
 * a "sample data" badge. Kept as a stable export for components that render it
 * conditionally.
 */
export function isSample(): boolean {
  return false;
}

export function verifiedLabel(): string {
  return "Verified buyer";
}

async function fetchPublished(slug?: string, limit=50): Promise<Row[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  let q = db
    .from("reviews")
    .select("product_slug, author, location, rating, title, body, verified, created_at")
    .eq("status", "published")
    .order("created_at", { ascending: false }).limit(Math.max(1,Math.min(50,limit)));
  if (slug) q = q.eq("product_slug", slug);
  const { data, error } = await q;
  if (error || !data) return [];
  return data as Row[];
}

type Aggregate = { rating:number;count:number };
const statistics = cache(async (slug?:string):Promise<Record<string,Aggregate>> => {
 const db=supabaseAdmin();if(!db)return {};
 const {data,error}=await db.rpc("review_statistics",{p_slugs:slug?[slug]:null});
 if(error){console.warn("Review statistics unavailable");return {};}
 return Object.fromEntries((data??[]).map((r:{product_slug:string|null;rating:number;count:number})=>[r.product_slug??"*",{rating:Number(r.rating),count:Number(r.count)}]));
});
const mapReview=(r:Row):Review=>({author:r.author,location:r.location??undefined,rating:r.rating,date:r.created_at.slice(0,10),verified:r.verified,title:r.title,body:r.body});
/** Most recent 50 reviews plus the complete aggregate. */
export const getProductReviews=cache(async (slug:string):Promise<ProductReviews|null>=>{
 const [stats,rows]=await Promise.all([statistics(slug),fetchPublished(slug)]);
 return stats[slug]?{...stats[slug],reviews:rows.map(mapReview)}:null;
});
export async function getAggregate(slug:string):Promise<Aggregate|null>{return (await statistics(slug))[slug]??null;}
export async function getSiteAggregate():Promise<Aggregate|null>{return (await statistics())["*"]??null;}
export async function getRecentReviews(limit=3):Promise<(Review&{productSlug:string})[]>{
 return (await fetchPublished(undefined,limit)).map(r=>({...mapReview(r),productSlug:r.product_slug}));
}
export async function getAggregates(slugs:string[]):Promise<Record<string,Aggregate>>{
 if(!slugs.length)return {};
 const db=supabaseAdmin();if(!db)return {};
 const {data,error}=await db.rpc("review_statistics",{p_slugs:slugs});
 if(error){console.warn("Review statistics unavailable");return {};}
 return Object.fromEntries((data??[]).filter((r:{product_slug:string|null})=>r.product_slug!==null)
  .map((r:{product_slug:string;rating:number;count:number})=>[r.product_slug,{rating:Number(r.rating),count:Number(r.count)}]));
}
