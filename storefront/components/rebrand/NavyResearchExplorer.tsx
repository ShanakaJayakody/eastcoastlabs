'use client';

import {useState} from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {ArrowUpRight, FlaskConical} from 'lucide-react';
import type {CardProduct} from '@/components/ProductCard';
import type {Collection} from '@/lib/collections';
import {rebrandHref} from '@/lib/rebrand-navigation';

export default function NavyResearchExplorer({collections, products}: {collections: Collection[]; products: CardProduct[]}) {
  const [selected, setSelected] = useState('');
  const current = collections.find(collection => collection.slug === selected) ?? collections[0];
  if (!current) return null;
  const slugs = current.showcase_product ? [current.showcase_product, ...current.products] : current.products;
  const product = slugs.map(slug => products.find(item => item.slug === slug)).find(item => item?.images?.length);

  return <section id="research-areas" className="rb-section rb-explorer" aria-labelledby="rb-explorer-title">
    <div className="rb-container">
      <div className="rb-section-heading">
        <div><p className="rb-eyebrow">Follow your curiosity</p><h2 id="rb-explorer-title">Explore by research area.</h2></div>
        <p className="rb-explorer-intro">A starting point for your next study.<br />Find compounds by the questions you’re exploring.</p>
      </div>
      <div className="rb-explorer-grid">
        <figure id="rb-area-preview" className="rb-area-preview">
          <span className="rb-eyebrow">The research collection</span>
          <div className="rb-area-image">
            {product ? <Image src={product.images![0].src} alt={`${product.name} — ${current.name} collection`} fill unoptimized sizes="(max-width: 760px) 80vw, 40vw" />
              : <FlaskConical size={72} strokeWidth={1} aria-hidden />}
          </div>
          <figcaption><span>{product?.name ?? current.name}</span><span>For laboratory research</span></figcaption>
        </figure>
        <div>
          <div className="rb-area-list" role="group" aria-label="Preview research areas">
            {collections.map((collection, index) => <div key={collection.slug} className={`rb-area-row${collection.slug === current.slug ? ' is-active' : ''}`}>
              <button type="button" aria-label={`Preview ${collection.name}`} aria-pressed={collection.slug === current.slug} aria-controls="rb-area-preview"
                onClick={() => setSelected(collection.slug)}>
                <span className="rb-area-number" aria-hidden>{String(index + 1).padStart(2, '0')}</span>
                <span><strong>{collection.name}</strong><small>{collection.tagline}</small></span>
              </button>
              <Link href={rebrandHref(`/collections/${collection.slug}`, 'v2')} aria-label={`Explore ${collection.name}`}><ArrowUpRight size={22} strokeWidth={1.4} aria-hidden /></Link>
            </div>)}
          </div>
          <p className="rb-area-note">Collection names describe research fields, not intended personal use.</p>
          <span className="sr-only" role="status">Previewing {current.name}{product ? `: ${product.name}` : ''}.</span>
        </div>
      </div>
    </div>
  </section>;
}
