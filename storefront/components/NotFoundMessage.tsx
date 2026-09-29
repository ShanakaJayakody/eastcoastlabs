import Link from 'next/link';

export default function NotFoundMessage() {
  return <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-5 py-24 text-center">
    <p className="text-xs font-semibold uppercase tracking-widest text-accent">East Coast Labs · 404</p>
    <h1 className="text-3xl font-semibold text-fg">Page not found</h1>
    <p className="text-sm leading-relaxed text-muted">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
    <Link href="/shop" className="rounded-md bg-accent px-5 py-3 text-sm font-semibold text-accent-ink hover:brightness-95">Browse research peptides</Link>
  </div>;
}
