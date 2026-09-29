import type {ReactNode} from 'react';
import Link from 'next/link';
import NavyBrand from './NavyBrand';
import './rebrand.css';
import './storefront-theme.css';

/** Private links retain the brand without loading cart, analytics or marketing. */
export default function NavyMessageShell({children}: {children: ReactNode}) {
  return <div className="rebrand navy-store navy-private flex min-h-screen flex-col">
    <header className="navy-private-header"><NavyBrand /></header>
    <main id="main-content" tabIndex={-1} className="flex-1">{children}</main>
    <footer className="navy-private-footer">East Coast Labs · <Link href="/contact">Contact us</Link> · <Link href="/privacy">Privacy policy</Link></footer>
  </div>;
}
