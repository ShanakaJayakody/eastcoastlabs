'use client';

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ArrowRight, ArrowUpRight, FlaskConical, Search, X } from 'lucide-react';
import type { CardProduct } from '@/components/ProductCard';
import { searchProducts, type ProductSearchMatch } from '@/lib/product-search';
import { normalizeProductSizeLabel, purchasableStartingPriceMinor } from '@/lib/product-sizes';
import { rebrandHref } from '@/lib/rebrand-navigation';
import { formatMinor, minorToMajor } from '@/lib/format';
import { commerceItem, trackSelectItem } from '@/lib/analytics';
import type { RebrandVariant } from './content';
import './product-finder.css';

function productHref({ product, size }: ProductSearchMatch, variant: RebrandVariant) {
  return rebrandHref(`/product/${product.slug}${size ? `?size=${encodeURIComponent(size.slug)}` : ''}`, variant);
}

function priceMinor({ product, size }: ProductSearchMatch) {
  return size?.priceMinor ?? purchasableStartingPriceMinor(product.sizes, product.prices.price);
}

function trackSelection(match: ProductSearchMatch) {
  trackSelectItem(commerceItem({
    slug: match.product.slug,
    name: match.product.name,
    size: match.size ? normalizeProductSizeLabel(match.size.label) : undefined,
    price: minorToMajor(priceMinor(match), match.product.prices.currency_minor_unit),
  }), 'homepage_search', 'Homepage product search');
}

export default function ProductFinder({ products, variant }: { products: CardProduct[]; variant: RebrandVariant }) {
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const keyboardSelection = useRef(false);
  const listId = `${useId()}-products`;
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const matches = useMemo(() => searchProducts(products, query), [products, query]);
  const suggestions = matches.slice(0, 5);
  const hasQuery = Boolean(query.trim());
  const shopHref = rebrandHref(`/shop${hasQuery ? `?${new URLSearchParams({ q: query.trim() })}` : ''}`, variant);
  const examples = ['bpc-157', 'klow', 'tesamorelin']
    .map(slug => products.find(product => product.slug === slug))
    .filter((product): product is CardProduct => Boolean(product));
  const message = !products.length ? 'Catalogue is temporarily unavailable. Please try again shortly.'
    : hasQuery ? `${matches.length} ${matches.length === 1 ? 'product' : 'products'} found` : 'Explore the collection';

  const close = () => { setOpen(false); setActive(-1); };
  const updateQuery = (value: string) => { setQuery(value); setActive(-1); setOpen(true); };

  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) {
        setOpen(false); setActive(-1);
      }
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, []);

  useEffect(() => {
    if (open && active >= 0 && keyboardSelection.current) {
      document.getElementById(`${listId}-${active}`)?.scrollIntoView?.({ block: 'nearest' });
    }
  }, [open, active, listId]);

  function navigate(match: ProductSearchMatch) {
    trackSelection(match);
    close();
    router.push(productHref(match, variant));
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Escape') {
      event.preventDefault(); close(); input.current?.scrollIntoView?.({ block: 'nearest' });
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); setOpen(true);
      if (!suggestions.length) return;
      keyboardSelection.current = true;
      setActive(index => !open || index < 0
        ? event.key === 'ArrowDown' ? 0 : suggestions.length - 1
        : (index + (event.key === 'ArrowDown' ? 1 : -1) + suggestions.length) % suggestions.length);
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (open && active >= 0 && suggestions[active]) navigate(suggestions[active]);
      else router.push(shopHref);
    }
  }

  return <div ref={root} className="rb-finder" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) close();
  }}>
    <form action="/shop" role="search" aria-label="Product finder" onSubmit={event => {
      event.preventDefault(); router.push(shopHref);
    }}>
      <label className="rb-finder-label" htmlFor="homepage-product-search">Search products</label>
      <input type="hidden" name="rebrand" value={variant} />
      <div className="rb-finder-field">
        <Search size={20} strokeWidth={1.5} aria-hidden />
        <input ref={input} id="homepage-product-search" name="q" type="search" role="combobox"
          value={query} onChange={event => updateQuery(event.target.value)} onFocus={() => setOpen(true)} onKeyDown={onKeyDown}
          placeholder="Product name or size…" maxLength={120} autoComplete="off" autoCapitalize="none" spellCheck={false}
          aria-autocomplete="list" aria-expanded={open} aria-controls={open ? listId : undefined}
          aria-activedescendant={open && active >= 0 && suggestions[active] ? `${listId}-${active}` : undefined} />
        {query && <button type="button" className="rb-finder-clear" aria-label="Clear search" onClick={() => {
          updateQuery(''); input.current?.focus();
        }}><X size={17} aria-hidden /></button>}
        <button type="submit" className="rb-finder-submit">Search</button>
      </div>
    </form>
    {examples.length > 0 && <div className="rb-finder-examples"><span>Try</span>{examples.map(product => <button
      type="button" key={product.slug} onClick={() => { updateQuery(product.name); input.current?.focus(); }}
    >{product.name}</button>)}</div>}
    <span className="sr-only" role="status" aria-live="polite">{open ? message : ''}</span>
    {open && <div className="rb-finder-panel">
      <div className="rb-finder-panel-heading"><span>{products.length ? message : 'Please try again shortly'}</span><span>Sizes & prices at a glance</span></div>
      <div id={listId} role="listbox" aria-label="Product suggestions">
        {suggestions.map((match, index) => {
          const { product, size } = match;
          // A parent vial may show a different strength from the matched size.
          const image = size ? size.images?.[0] : product.images?.[0];
          const sizes = size ? [size] : product.sizes ?? [];
          const inStock = size ? size.available > 0 : sizes.length ? sizes.some(option => option.available > 0) : product.is_in_stock !== false;
          return <Link key={product.slug} id={`${listId}-${index}`} role="option" aria-selected={active === index}
            tabIndex={-1} href={productHref(match, variant)} className="rb-finder-result"
            onMouseMove={() => { keyboardSelection.current = false; setActive(index); }} onMouseDown={event => event.preventDefault()} onClick={() => { trackSelection(match); close(); }}>
            <span className="rb-finder-image">{image ? <Image src={image.src} alt="" width={60} height={72} unoptimized /> : <FlaskConical size={25} strokeWidth={1.2} aria-hidden />}</span>
            <span className="rb-finder-product"><span className="rb-finder-name">{product.name}</span><span className="rb-finder-sizes">{sizes.length
              ? sizes.map(option => `${normalizeProductSizeLabel(option.label)}${option.available > 0 ? '' : ' (unavailable)'}`).join(' · ')
              : 'View product details'}</span></span>
            <span className="rb-finder-price">{!size && sizes.length > 1 ? 'From ' : ''}{formatMinor(priceMinor(match), product.prices)}<span
              className={`rb-finder-stock${inStock ? '' : ' rb-finder-out'}`}>{inStock ? 'In stock' : 'Out of stock'}</span></span>
            <ArrowUpRight size={17} aria-hidden />
          </Link>;
        })}
      </div>
      {!suggestions.length && <div className="rb-finder-empty">
        <p>{products.length ? 'No products found' : 'Catalogue is temporarily unavailable. Please try again shortly.'}</p>
        {products.length > 0 && <span>Try a product name, such as {examples[0]?.name ?? products[0].name}, or explore the full collection.</span>}
      </div>}
      <Link className="rb-finder-all" href={matches.length ? shopHref : rebrandHref('/shop', variant)}>
        {hasQuery && matches.length ? `View all ${matches.length} ${matches.length === 1 ? 'result' : 'results'}` : 'Browse all peptides'}<ArrowRight size={17} aria-hidden />
      </Link>
    </div>}
  </div>;
}
