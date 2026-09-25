import { describe, expect, it } from 'vitest';
import { getRebrandImage, rebrandHref, parseRebrandVariant, withRebrandImages } from '@/lib/rebrand-imagery';

describe('rebrand product imagery', () => {
  it('selects the exact labelled size, and never guesses an unpictured strength', () => {
    expect(getRebrandImage('ghk-cu', 'v3', '50')?.src).toBe('/images/rebrand/vials/v3/ghk-cu-50mg.webp');
    expect(getRebrandImage('ghk-cu', 'v1', '100mg')?.alt).toContain('100 mg');
    expect(getRebrandImage('retatrutide', 'v2', '20 mg')?.src).toContain('retatrutide-20mg.webp');
    expect(getRebrandImage('retatrutide', 'v2', '30 mg')).toBeNull();
    expect(getRebrandImage('future-product', 'v1')).toBeNull();
  });
  it('changes presentation without changing stock, prices, identity or source records', () => {
    const source = { slug: 'ghk-cu', images: [{ src: '/original.png' }], available: 7, sizes: [
      { slug: 'ghk-cu', label: '100', available: 0, priceMinor: '4000', images: [{ src: '/100.png' }] },
      { slug: 'child-50', label: '50mg', available: 7, priceMinor: '2000', images: [{ src: '/50.png' }] },
    ] };
    expect(withRebrandImages(source, undefined)).toBe(source);
    const result = withRebrandImages(source, 'v2');
    expect(result.images[0].src).toContain('ghk-cu-50mg.webp');
    expect(result.sizes[0].images[0].src).toContain('/ghk-cu.webp');
    expect(result.sizes[1]).toMatchObject({ slug: 'child-50', available: 7, priceMinor: '2000' });
    expect(source.images[0].src).toBe('/original.png');
    expect(source.sizes[1].images[0].src).toBe('/50.png');
  });
  it('retains existing query parameters and anchors while carrying the chosen design', () => {
    expect(rebrandHref('/product/ghk-cu?size=child-50#pack-options', 'v3')).toBe('/product/ghk-cu?size=child-50&rebrand=v3#pack-options');
    expect(rebrandHref('/shop', undefined)).toBe('/shop');
    expect(parseRebrandVariant('v2')).toBe('v2');
    expect(parseRebrandVariant('invalid')).toBeUndefined();
    expect(parseRebrandVariant(['v1', 'v3'])).toBeUndefined();
  });
});
