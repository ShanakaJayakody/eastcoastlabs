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
import { getPricing } from "./pricing";
import { getProducts } from "./woo";

export interface StackComponent {
  slug: string;
  name: string;
  image?: string;
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

export async function getStacks(): Promise<ResolvedStack[]> {
  const products = await getProducts(50);
  const bySlug = new Map(products.map((p) => [p.slug, p]));

  const resolved: ResolvedStack[] = [];
  for (const raw of RAW) {
    const components: StackComponent[] = [];
    let componentsTotal = 0;
    let ok = true;

    for (const slug of raw.components) {
      const product = bySlug.get(slug);
      const pricing = getPricing(slug, product?.name);
      if (!product || !pricing) {
        ok = false;
        break;
      }
      componentsTotal += pricing.singleVial;
      components.push({
        slug,
        name: product.name,
        image: product.images?.[0]?.src,
        singleVial: pricing.singleVial,
      });
    }

    if (!ok || components.length === 0) continue;

    const bundlePrice = Math.round(componentsTotal * (1 - raw.discountPct / 100));
    resolved.push({
      slug: raw.slug,
      name: raw.name,
      tagline: raw.tagline,
      blurb: raw.blurb,
      badge: raw.badge,
      discountPct: raw.discountPct,
      freeBacWater: raw.freeBacWater ?? false,
      components,
      componentsTotal: Math.round(componentsTotal * 100) / 100,
      bundlePrice,
      savings: Math.round((componentsTotal - bundlePrice) * 100) / 100,
    });
  }
  return resolved;
}

export async function getStackBySlug(slug: string): Promise<ResolvedStack | null> {
  return (await getStacks()).find((s) => s.slug === slug) ?? null;
}
