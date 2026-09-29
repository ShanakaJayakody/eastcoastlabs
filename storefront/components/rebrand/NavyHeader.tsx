'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Menu, Search, ShoppingBag, X } from 'lucide-react';
import Modal from '@/components/Modal';
import { useCart } from '@/lib/cart-context';
import { useUI } from '@/lib/ui-context';
import NavyBrand from './NavyBrand';

const navigation = [
  { href: '/shop?rebrand=v2', label: 'Shop' },
  { href: '/stacks?rebrand=v2', label: 'Stacks' },
  { href: '/lab-results', label: 'Lab reports' },
  { href: '/learn', label: 'Learn' },
  { href: '/creators', label: 'Creators' },
  { href: '/about', label: 'About' },
];

export default function NavyHeader() {
  const [open, setOpen] = useState(false);
  const { itemCount, ready } = useCart();
  const { openCart } = useUI();
  return <>
    <a href="#main-content" className="rb-skip">Skip to content</a>
    <div className="rb-announcement">
      <div className="rb-container rb-announcement-inner">
        <span>Australian owned. Shipped from Australia.</span>
        <a href="#standards">Original lab reports, open to you <ArrowUpRight size={13} aria-hidden /></a>
      </div>
    </div>
    <header className="rb-header">
      <div className="rb-container rb-header-inner">
        <NavyBrand />
        <nav className="rb-desktop-nav" aria-label="Main navigation">
          {navigation.map(item => <Link key={item.href} href={item.href}>{item.label}</Link>)}
        </nav>
        <div className="rb-header-actions">
          <a className="rb-icon-button rb-search" href="#homepage-product-search" aria-label="Search peptides" onClick={event => {
            const search = document.getElementById('homepage-product-search');
            if (search) { event.preventDefault(); search.focus(); }
          }}><Search size={21} strokeWidth={1.5} aria-hidden /></a>
          <button className="rb-bag" type="button" onClick={openCart} aria-label={`Open shopping bag, ${ready ? itemCount : 0} items`}>
            <ShoppingBag size={20} strokeWidth={1.5} aria-hidden /><span>Bag</span><span className="rb-bag-count">{ready ? itemCount : 0}</span>
          </button>
          <button className="rb-icon-button rb-menu-toggle" type="button" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open} aria-controls="rb-mobile-menu"><Menu size={23} /></button>
        </div>
      </div>
    </header>
    <Modal open={open} onClose={() => setOpen(false)} label="Navigation menu" className="rb-menu-panel absolute inset-0">
      <div className="rb-menu-top"><NavyBrand onNavigate={() => setOpen(false)} /><button className="rb-icon-button" type="button" onClick={() => setOpen(false)} aria-label="Close menu"><X size={24} /></button></div>
      <nav id="rb-mobile-menu" aria-label="Mobile navigation">
        {navigation.map(item => <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>{item.label}<ArrowUpRight size={21} aria-hidden /></Link>)}
        <a href="#collection" onClick={() => setOpen(false)}>Explore this page<ArrowUpRight size={21} aria-hidden /></a>
        <a href="#ordering" onClick={() => setOpen(false)}>Ordering & delivery<ArrowUpRight size={21} aria-hidden /></a>
      </nav>
      <p>East Coast Labs · Australian owned<br />For laboratory research only.</p>
    </Modal>
  </>;
}
