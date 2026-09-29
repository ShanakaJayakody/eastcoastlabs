import Image from 'next/image';
import Link from 'next/link';

/** The original ECL artwork, paired with the established storefront wordmark. */
export default function NavyBrand({ footer = false, onNavigate }: { footer?: boolean; onNavigate?: () => void }) {
  return (
    <Link href="/2" onClick={onNavigate} className={`rb-brand${footer ? ' rb-brand-footer' : ''}`} aria-label="East Coast Labs home">
      <Image src="/logo.png" alt="" width={42} height={45} unoptimized priority={!footer} />
      <span className="rb-brand-type">
        <strong>EAST COAST LABS</strong>
        <span>RESEARCH PEPTIDES</span>
      </span>
    </Link>
  );
}
