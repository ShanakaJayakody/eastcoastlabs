import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
      <p className="text-5xl">🧪</p>
      <h1 className="text-2xl font-bold text-fg">Page not found</h1>
      <p className="text-sm text-muted">
        The page you&apos;re looking for doesn&apos;t exist or has moved.
      </p>
      <Link
        href="/shop"
        className="rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink hover:brightness-95"
      >
        Browse research peptides
      </Link>
    </div>
  );
}
