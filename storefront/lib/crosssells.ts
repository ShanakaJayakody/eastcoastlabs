import crossSells from "@/data/cross-sells.json";

const DATA = crossSells as unknown as {
  mappings: Record<string, string[]>;
  default: string[];
};

/** Live catalog slug -> cross-sell map slug aliases. */
const SLUG_ALIASES: Record<string, string> = {
  igf: "igf-1-lr3",
};

/** Curated cross-sell slugs for a product (scientifically relevant pairings). */
export function getCrossSellSlugs(slug: string): string[] {
  const key = SLUG_ALIASES[slug] ?? slug;
  return DATA.mappings[key] ?? DATA.mappings[slug] ?? DATA.default;
}
