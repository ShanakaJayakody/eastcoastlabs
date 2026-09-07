import type { CartLine } from './cart-context';
import stacks from '@/data/stacks.json';
import { getAccessory } from './accessories';
export const MAX_CART_QUANTITY = 99;
export function cartLineDestination(line: Pick<CartLine,'key'|'slug'>): string {
  if (line.key.startsWith('stack:')) return `/stacks#${encodeURIComponent(line.slug)}`;
  if (getAccessory(line.slug)) return '/shop#accessories';
  return `/product/${encodeURIComponent(line.slug)}`;
}
export function cartLineVials(line: Pick<CartLine,'variantLabel'>): number {
  const match = line.variantLabel.match(/^(\d+)[ -]?(?:pack|vials?)/i);
  return match ? Number(match[1]) : 1;
}
export function reservedVials(lines: CartLine[], slug: string): number {
  return lines.reduce((sum,line)=> {
    const components = line.components ?? (line.key.startsWith("stack:") ? stacks.stacks.find(s => s.slug === line.slug)?.components : undefined);
    return sum + (components?.includes(slug) ? line.quantity : line.slug===slug ? cartLineVials(line)*line.quantity : 0);
  },0);
}
