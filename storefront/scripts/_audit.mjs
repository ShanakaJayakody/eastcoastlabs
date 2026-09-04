import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
const root = "/Users/shanakajayakody/eastcoastlabs/storefront";
const env = Object.fromEntries(fs.readFileSync(root+"/.env.local","utf8").split("\n").filter(l=>l.includes("=")&&!l.trim().startsWith("#")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,"")];}));
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const table = JSON.parse(fs.readFileSync(root+"/data/price-table.json","utf8"));
const byslug = new Map(table.products.map(p=>[p.slug,p]));
const alias = { igf: "igf-1-lr3" };
const f = (c)=> (c/100).toFixed(0);
const tier=(s,n,d)=>Math.round((s*n*(1-d))/100)*100;
const { data } = await db.from("products").select("slug,name,status,product_variants(pack_size,price_cents)").eq("status","active");
console.log("slug            | 1v  | DB3  DB6 | tbl3 tbl6 | new3 new6");
for (const p of data.sort((a,b)=>a.slug.localeCompare(b.slug))) {
  const v = Object.fromEntries((p.product_variants||[]).map(x=>[x.pack_size,x.price_cents]));
  if (!v[3]) { console.log(`${p.slug.padEnd(15)} | ${f(v[1]||0).padStart(3)} | (no pack tiers)`); continue; }
  const t = byslug.get(alias[p.slug]??p.slug) || table.products.find(x=>x.name.toLowerCase().replace(/[^a-z0-9]/g,"")===p.name.toLowerCase().replace(/[^a-z0-9]/g,""));
  const s = v[1];
  console.log(`${p.slug.padEnd(15)} | ${f(s).padStart(3)} | ${f(v[3]).padStart(4)} ${f(v[6]).padStart(4)} | ${String(t?.prices["3_pack"]??"-").padStart(4)} ${String(t?.prices["6_pack"]??"-").padStart(4)} | ${f(tier(s,3,0.10)).padStart(4)} ${f(tier(s,6,0.20)).padStart(4)}`);
}
