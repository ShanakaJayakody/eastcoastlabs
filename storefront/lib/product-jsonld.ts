import type { TierCard } from './pricing';

interface JsonLdSize {
  slug: string;
  sku?: string;
  label: string;
  available: number;
  priceMinor: string;
  tiers: TierCard[] | null;
  images?: { src: string }[];
}

interface JsonLdProduct {
  name: string;
  slug: string;
  sku: string;
  description: string;
  currency: string;
  images: string[];
  sizes?: JsonLdSize[];
  price?: number;
  available?: boolean;
  rating?: { rating: number; count: number } | null;
}

const SITE = 'https://www.eastcoastlabs.com.au';
const availability = (inStock: boolean) => `https://schema.org/${inStock ? 'InStock' : 'OutOfStock'}`;

/** JSON-LD is inline script data, so escape the only character that can open an HTML end tag. */
export function serializeProductJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function buildProductJsonLd(product: JsonLdProduct) {
  const rating = product.rating ? {
    aggregateRating: {
      '@type': 'AggregateRating', ratingValue: product.rating.rating.toFixed(1), reviewCount: product.rating.count,
      bestRating: '5', worstRating: '1',
    },
  } : {};
  const common = {
    '@context': 'https://schema.org/',
    name: product.name,
    description: product.description,
    brand: { '@type': 'Brand', name: 'East Coast Labs' },
    image: product.images,
    ...rating,
  };
  if (product.sizes?.length) {
    return {
      ...common,
      '@type': 'ProductGroup',
      productGroupID: product.slug,
      variesBy: 'https://schema.org/size',
      hasVariant: product.sizes.map((size) => {
        const tiers = size.tiers?.length ? size.tiers : [{ id: 'single', label: '1 vial', vials: 1, total: Number(size.priceMinor) / 100, perVial: Number(size.priceMinor) / 100 } as TierCard];
        return {
          '@type': 'Product',
          name: `${product.name} ${size.label}`,
          sku: size.sku || undefined,
          size: size.label,
          image: size.images?.map((image) => image.src).filter(Boolean).length ? size.images?.map((image) => image.src) : product.images,
          offers: tiers.map((tier) => ({
            '@type': 'Offer',
            priceCurrency: product.currency,
            price: tier.total.toFixed(2),
            availability: availability(size.available >= tier.vials),
            url: `${SITE}/product/${product.slug}?size=${encodeURIComponent(size.slug)}`,
          })),
        };
      }),
    };
  }
  return {
    ...common,
    '@type': 'Product',
    sku: product.sku,
    offers: {
      '@type': 'Offer', priceCurrency: product.currency, price: (product.price ?? 0).toFixed(2),
      availability: availability(product.available !== false), url: `${SITE}/product/${product.slug}`,
    },
  };
}
