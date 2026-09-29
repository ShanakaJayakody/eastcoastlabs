import type { Metadata } from 'next';
import Link from 'next/link';
import { getSettings } from '@/lib/settings';
import { customerAccountsEnabled } from '@/lib/customer-orders/flags';
import './customer.css';
export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: 'no-referrer' };
export const dynamic = 'force-dynamic';
export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  return <div className="co-shell"><a className="co-skip" href="#customer-content">Skip to content</a>
    <header className="co-header"><Link href="/" className="co-wordmark" aria-label="East Coast Labs home">EAST COAST <strong>LABS</strong><span>AUSTRALIAN RESEARCH SUPPLY</span></Link>
      <nav aria-label="Customer navigation"><Link href="/shop">Shop</Link>{customerAccountsEnabled() && <Link href="/account/orders">My orders</Link>}</nav></header>
    <main id="customer-content" className="co-main">{children}</main>
    <footer className="co-footer"><p>Need help? <a href={`mailto:${settings.supportEmail}`}>{settings.supportEmail}</a></p>
      <nav aria-label="Policies"><Link href="/shipping">Shipping</Link><Link href="/returns">Returns</Link><Link href="/privacy">Privacy</Link></nav><p>East Coast Labs · Research use only.</p></footer>
  </div>;
}
