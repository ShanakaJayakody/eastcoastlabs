import Link from 'next/link';

/** A single-ink ECL mark and wordmark for the navy review direction. */
export default function NavyBrand({ footer = false, onNavigate }: { footer?: boolean; onNavigate?: () => void }) {
  return (
    <Link href="/2" onClick={onNavigate} className={`rb-brand${footer ? ' rb-brand-footer' : ''}`} aria-label="East Coast Labs home">
      <span className="rb-brand-mark" aria-hidden="true" />
      <span className="rb-brand-type">
        <strong>EAST COAST LABS</strong>
        <span>RESEARCH PEPTIDES</span>
      </span>
    </Link>
  );
}
