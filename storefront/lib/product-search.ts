import type { CardProduct } from '@/components/ProductCard';
import { normalizeProductSizeLabel, type ProductSizeOption } from './product-sizes';

export interface ProductSearchMatch {
  product: CardProduct;
  size?: ProductSizeOption;
}

const compact = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const sizePattern = /\b(\d+(?:\.\d+)?)\s*(mcg|mg|ml|g)\b/gi;
const sizeKey = (amount: string, unit: string) => `${Number(amount)}${unit.toLowerCase()}`;

/** Shared by homepage suggestions and the full shop. Size units match exactly;
 * punctuation and spacing in compound names/SKUs do not affect discovery. */
export function searchProducts(products: readonly CardProduct[], query: string): ProductSearchMatch[] {
  const requestedSizes = [...query.matchAll(sizePattern)].map(match => sizeKey(match[1], match[2]));
  const words = query.replace(sizePattern, ' ').split(/\s+/).map(compact).filter(Boolean);
  if (!requestedSizes.length && !words.length) {
    return query.trim() ? [] : products.map(product => ({ product }));
  }
  const term = words.join('');
  const ranked: (ProductSearchMatch & { rank: number })[] = [];
  for (const product of products) {
    const base = [product.name, product.slug];
    const matchesWords = (fields: string[]) => words.every(word => fields.some(field => compact(field).includes(word)));
    const matchesSizes = (label: string) => {
      const available = [...label.matchAll(sizePattern)].map(match => sizeKey(match[1], match[2]));
      return requestedSizes.every(size => available.includes(size));
    };
    let size: ProductSizeOption | undefined;
    if (product.sizes?.length) {
      const sizes = product.sizes.filter(option => matchesSizes(normalizeProductSizeLabel(option.label)) &&
        matchesWords([...base, option.sku ?? (option.slug === product.slug ? product.sku : ''), option.slug, normalizeProductSizeLabel(option.label)]));
      if (!sizes.length) continue;
      const exactSku = sizes.find(option => term && compact(option.sku ?? '') === term);
      size = exactSku ?? (requestedSizes.length || !matchesWords(base)
        ? sizes.find(option => option.available > 0) ?? sizes[0]
        : undefined);
    } else if (!matchesWords([...base, product.sku]) || !matchesSizes(product.name)) {
      continue;
    }
    const name = compact(product.name);
    const exact = name === term || compact(size?.sku ?? product.sku) === term;
    const rank = exact ? 0 : term && name.startsWith(term) ? 1 : 2;
    const inStock = size ? size.available > 0 : product.sizes?.length
      ? product.sizes.some(option => option.available > 0) : product.is_in_stock !== false;
    ranked.push({ product, size, rank: rank * 2 + Number(!inStock) });
  }
  // Stable sorting retains catalogue popularity within equally relevant matches.
  return ranked.sort((a, b) => a.rank - b.rank);
}
