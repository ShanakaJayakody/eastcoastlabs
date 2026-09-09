import "server-only";
import { cache } from "react";
import { supabasePublic } from "./supabase";

export interface CoaRecord {
  batch_id: string;
  compound: string;
  purity_pct: number;
  lab: string;
  test_date: string;
  coa_url: string;
  lab_verify_url: string;
}

/** Published evidence requires an operator-verified document. No historical
 * CSV or retired Woo endpoint can substitute for missing certificates. */
function trustedDocument(value: unknown): boolean {
  try {
    const url = new URL(String(value));
    const storageHost = process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : "";
    return url.protocol === "https:" && !url.username && !url.password &&
      (url.hostname === "eastcoastlabs.com.au" || url.hostname === "www.eastcoastlabs.com.au" ||
       url.hostname === "janoshik.com" || url.hostname === "www.janoshik.com" ||
       (url.hostname === storageHost && url.pathname.startsWith("/storage/v1/object/public/"))) &&
      /\.pdf$/i.test(url.pathname);
  } catch { return false; }
}

export const getAllCoa = cache(async (): Promise<CoaRecord[]> => {
  const db = supabasePublic();
  if (!db) return [];
  try {
    const { data, error } = await db.from("coa_batches")
      .select("batch_id,compound,purity_pct,lab,test_date,coa_url,lab_verify_url,document_verified_at");
    if (error || !Array.isArray(data)) return [];
    return data.filter(r => r.document_verified_at &&
      Number.isFinite(Date.parse(r.document_verified_at)) && trustedDocument(r.coa_url) &&
      Number.isFinite(Number(r.purity_pct)) && Number(r.purity_pct) >= 0 && Number(r.purity_pct) <= 100)
      .map(r => ({batch_id:String(r.batch_id),compound:String(r.compound),purity_pct:Number(r.purity_pct),lab:String(r.lab ?? ""),test_date:String(r.test_date ?? ""),coa_url:String(r.coa_url),lab_verify_url:/^https:\/\/(www\.)?janoshik\.com\//.test(r.lab_verify_url ?? "") ? r.lab_verify_url : ""}))
      .sort((a,b) => b.test_date.localeCompare(a.test_date));
  } catch { return []; }
});

export async function getLatestCoa(limit = 6): Promise<CoaRecord[]> {
  return (await getAllCoa()).slice(0, limit);
}
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
export async function getCoaForProduct(name: string, slug?: string): Promise<CoaRecord | null> {
  return (await getAllCoa()).find(r => normalize(r.compound) === normalize(name) ||
    (slug && normalize(r.compound) === normalize(slug))) ?? null;
}
