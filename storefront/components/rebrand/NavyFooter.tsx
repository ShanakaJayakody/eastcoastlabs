import Link from 'next/link';
import NewsletterForm from '@/components/NewsletterForm';
import MarketingOnly from '@/components/MarketingOnly';
import {ArrowUpRight, MapPin} from 'lucide-react';
import NavyBrand from './NavyBrand';
import type {RebrandProps} from './RebrandExperience';

export default function NavyFooter({collections, supportEmail, supportHours, legalName, abn}: Pick<RebrandProps, 'collections' | 'supportEmail' | 'supportHours' | 'legalName' | 'abn'>) {
  return <footer className="rb-footer" id="contact"><div className="rb-container">
    <MarketingOnly><section className="rb-newsletter" aria-labelledby="rb-newsletter-title">
      <div><p className="rb-eyebrow">The next chapter</p><h2 id="rb-newsletter-title">Stay curious. <br />Stay informed.</h2><p>Updates on new research compounds and returning stock, delivered to your inbox.</p></div>
      <div className="rb-newsletter-form"><NewsletterForm source="footer" cta="Subscribe" /><p>Confirm your subscription by email. Unsubscribe any time. <Link href="/privacy">Privacy policy</Link></p></div>
    </section></MarketingOnly>
    <div className="rb-footer-grid">
      <div className="rb-footer-brand"><NavyBrand footer /><p>Australian-owned supplier of laboratory research peptides.</p><span className="rb-location"><MapPin size={15} aria-hidden />Australia</span></div>
      <nav aria-label="Footer collection links"><h3>Explore</h3><Link href="/shop">Shop peptides</Link><Link href="/stacks">Research stacks</Link><Link href="/lab-results">Lab reports</Link><Link href="/learn">Research library</Link><Link href="/creators">Creators</Link><Link href="/about">About us</Link></nav>
      <nav aria-label="Footer research areas"><h3>By research area</h3>{collections.map(collection => <Link key={collection.slug} href={`/collections/${collection.slug}`}>{collection.name}</Link>)}</nav>
      <nav aria-label="Customer information"><h3>Customer care</h3><Link href="/contact">Contact & business details</Link><Link href="/shipping">Shipping & payment</Link><Link href="/returns">Returns & order support</Link><Link href="/privacy">Privacy policy</Link><Link href="/terms">Purchase terms</Link></nav>
    </div>
    <div className="rb-footer-support"><div><h3>Let’s talk</h3><a className="rb-support-email" href={`mailto:${supportEmail}`}>{supportEmail}</a>{supportHours && <p>{supportHours}</p>}</div><Link href="/shop" className="rb-text-link">Find your next research peptide<ArrowUpRight size={18} aria-hidden /></Link></div>
    <p className="rb-footer-disclaimer">For laboratory research only. Not for human or animal consumption. We don’t provide medical, dosing or administration advice.</p>
    <div className="rb-footer-bottom"><span>© {new Date().getFullYear()} {legalName || 'East Coast Labs'}{abn ? ` · ABN ${abn}` : ''}</span><span>Australian owned. Here to help.</span></div>
  </div></footer>;
}
