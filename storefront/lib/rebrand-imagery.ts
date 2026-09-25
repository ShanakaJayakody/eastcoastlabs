import type { RebrandVariant } from '@/components/rebrand/content';
import { normalizeProductSizeLabel } from './product-sizes';
import type { WooImage } from './woo';

/** Presentation assets only: the catalogue remains the authority for offers. */
const vials: Record<string, { name: string; strength: string; sizes?: Record<string, string> }> = {
  retatrutide: { name: 'Retatrutide', strength: '10 mg', sizes: { '20 mg': 'retatrutide-20mg' } },
  'ghk-cu': { name: 'GHK-CU', strength: '100 mg', sizes: { '50 mg': 'ghk-cu-50mg' } },
  'bpc-157': { name: 'BPC-157', strength: '10 mg' },
  klow: { name: 'KLOW', strength: '80 mg' },
  'mots-c': { name: 'MOTS-C', strength: '10 mg' },
  semaglutide: { name: 'Semaglutide', strength: '10 mg' },
  tirzepatide: { name: 'Tirzepatide', strength: '10 mg' },
  'tb-500': { name: 'TB-500', strength: '10 mg' },
  selank: { name: 'Selank', strength: '10 mg' },
  tesamorelin: { name: 'Tesamorelin', strength: '10 mg' },
  semax: { name: 'Semax', strength: '10 mg' },
  igf: { name: 'IGF-LR3', strength: '1 mg' },
  glow: { name: 'GLOW', strength: '70 mg' },
  'bacteriostatic-water': { name: 'Bacteriostatic Water', strength: '10 ml' },
  mt2: { name: 'MT2', strength: '10 mg' },
  'nad-plus': { name: 'NAD+', strength: '500 mg' },
  'ss-31': { name: 'SS-31', strength: '50 mg' },
  kpv: { name: 'KPV', strength: '10 mg' },
  'oxytocin': { name: 'OXYTOCIN', strength: '10 mg' },
  'pt-141': { name: 'PT-141', strength: '10 mg' },
  'adamax': { name: 'ADAMAX', strength: '10 mg' },
  'bpc-157-tb-500': { name: 'BPC-157 + TB-500', strength: '10 mg' },
  'cagrilintide': { name: 'CAGRILINTIDE', strength: '10 mg' },
  'dsip': { name: 'DSIP', strength: '10 mg' },
  'melanotan-1': { name: 'MELANOTAN I', strength: '10 mg' },
  'tesamorelin-ipamorelin': { name: 'TESAMORELIN + IPAMORELIN', strength: '10 mg' },
  'cjc-1295-no-dac': { name: 'CJC-1295 (NO DAC)', strength: '10 mg' },
  'cjc-1295-ipamorelin': { name: 'CJC-1295 + IPAMORELIN', strength: '10 mg' },
  'glutathione': { name: 'GLUTATHIONE', strength: '1500 mg' },
  'ipamorelin': { name: 'IPAMORELIN', strength: '10 mg' },
  '5-amino-1mq': { name: '5-AMINO-1MQ', strength: '50 mg' },
  'aod-9604': { name: 'AOD-9604', strength: '5 mg' },
  'epitalon': { name: 'EPITALON', strength: '10 mg' },
  'ahk-cu': { name: 'AHK-CU', strength: '100 mg' },
  'ara-290': { name: 'ARA-290', strength: '10 mg' },
  'll-37': { name: 'LL-37', strength: '5 mg' },
  'sermorelin': { name: 'SERMORELIN', strength: '5 mg' },
  'snap-8': { name: 'SNAP-8', strength: '10 mg' },
  'thymosin-alpha-1': { name: 'THYMOSIN ALPHA-1', strength: '10 mg' },
};

export function parseRebrandVariant(value: unknown): RebrandVariant | undefined {
  return value === 'v1' || value === 'v2' || value === 'v3' ? value : undefined;
}

export function getRebrandImage(slug: string, variant: RebrandVariant, size?: string): WooImage | null {
  const vial = vials[slug];
  if (!vial) return null;
  const strength = size ? normalizeProductSizeLabel(size) : vial.strength;
  const asset = strength === vial.strength ? slug : vial.sizes?.[strength];
  // Never use an illustration labelled with a different strength.
  if (!asset) return null;
  return {
    src: `/images/rebrand/vials/${variant}/${asset}.webp`,
    alt: `${vial.name} ${strength} research vial — East Coast Labs`,
  };
}

export function rebrandImageVariant(src?: string): RebrandVariant | undefined {
  return parseRebrandVariant(src?.match(/^\/images\/rebrand\/vials\/(v[123])\//)?.[1]);
}

export function rebrandHref(href: string, variant?: RebrandVariant): string {
  if (!variant) return href;
  const url = new URL(href, 'https://www.eastcoastlabs.com.au');
  url.searchParams.set('rebrand', variant);
  return `${url.pathname}${url.search}${url.hash}`;
}

interface IllustratedProduct {
  slug: string;
  images?: WooImage[];
  sizes?: { label: string; available: number; images?: WooImage[] }[];
}

export function withRebrandImages<T extends IllustratedProduct>(product: T, variant?: RebrandVariant): T {
  if (!variant) return product;
  const sizes = product.sizes?.map(size => {
    const image = getRebrandImage(product.slug, variant, size.label);
    return image ? { ...size, images: [image] } : size;
  });
  const selected = sizes?.find(size => size.available > 0) ?? sizes?.[0];
  const image = getRebrandImage(product.slug, variant, selected?.label);
  return { ...product, ...(sizes ? { sizes } : {}), ...(image ? { images: [image] } : {}) };
}
