/**
 * Research stacks (bundles) data layer.
 *
 * A stack groups peptides that are commonly researched together and prices the
 * set below the sum of the individual single-vial prices. Component prices come
 * from lib/pricing (the 1/3/6 table); images/names come from the catalog. All
 * resolution is server-side; StackCard receives plain data and owns the
 * add-to-cart interaction.
 */

import stacksData from "@/data/stacks.json";
import { cache } from "react";
import { getCatalog } from "./catalog";

export interface StackComponent {
  slug: string;
  name: string;
  image?: string;
  available: number;
  singleVial: number; // AUD major units
}

export interface ResolvedStack {
  slug: string;
  name: string;
  tagline: string;
  blurb: string;
  badge?: string;
  discountPct: number;
  freeBacWater: boolean;
  components: StackComponent[];
  available: number;
  componentsTotalCents: number;
  bundlePriceCents: number;
  componentsTotal: number; // sum of single-vial prices
  bundlePrice: number; // discounted, whole dollars
  savings: number; // componentsTotal - bundlePrice
}

interface RawStack {
  slug: string;
  name: string;
  tagline: string;
  blurb: string;
  components: string[];
  discountPct: number;
  badge?: string;
  freeBacWater?: boolean;
}

const RAW = (stacksData as unknown as { stacks: RawStack[] }).stacks;

export const getStacks = cache(async function getStacks(): Promise<ResolvedStack[]> {
  const { products } = await getCatalog();
  const bySlug = new Map(products.map((p) => [p.slug, p]));

  const resolved: ResolvedStack[] = [];
  for (const raw of RAW) {
    const components: StackComponent[] = [];
    let componentsTotalCents = 0;
    let ok = true;

    for (const slug of raw.components) {
      const product = bySlug.get(slug);
      if (!product || !Number.isSafeInteger(Number(product.prices.price))) {
        ok = false;
        break;
      }
      // Stack definitions name the original SKU. Other sizes must never
      // substitute their price or stock for that promised component.
      const originalSize=product.sizes?.find(size=>size.slug===slug);
      if(product.sizes && !originalSize){ok=false;break;}
      componentsTotalCents += Number(product.prices.price);
      components.push({
        slug,
        name: `${product.name}${originalSize ? ` · ${originalSize.label}` : ''}`,
        image: product.images?.[0]?.src,
        singleVial: Number(product.prices.price) / 100,
        available: originalSize ? originalSize.available : product.is_in_stock === false ? 0 : product.available,
      });
    }

    if (!ok || components.length === 0) continue;

    const bundlePriceCents = Math.round(componentsTotalCents * (1 - raw.discountPct / 100));
    const componentsTotal = componentsTotalCents / 100;
    const bundlePrice = bundlePriceCents / 100;
    resolved.push({
      slug: raw.slug,
      name: raw.name,
      tagline: raw.tagline,
      blurb: raw.blurb,
      badge: raw.badge,
      discountPct: raw.discountPct,
      freeBacWater: raw.freeBacWater ?? false,
      components,
      available: Math.min(...components.map(c => c.available)),
      componentsTotalCents,
      bundlePriceCents,
      componentsTotal: Math.round(componentsTotal * 100) / 100,
      bundlePrice,
      savings: Math.round((componentsTotal - bundlePrice) * 100) / 100,
    });
  }
  return resolved;
});

export async function getStackBySlug(slug: string): Promise<ResolvedStack | null> {
  return (await getStacks()).find((s) => s.slug === slug) ?? null;
}
