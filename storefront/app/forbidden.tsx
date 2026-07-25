import Link from "next/link";

// Rendered by forbidden() in lib/admin/auth.ts for a signed-in user who is not
// on the admin allow-list. Returns a real 403 status.
export default function Forbidden() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-ink px-4 text-center bg-grid">
      <p className="font-mono text-sm text-warn">403</p>
      <h1 className="text-2xl font-bold text-fg">Not authorised</h1>
      <p className="max-w-sm text-sm text-muted">
        You&apos;re signed in, but this account isn&apos;t on the East Coast Labs
        admin allow-list.
      </p>
      <Link
        href="/admin/login"
        className="mt-4 rounded-lg border border-line bg-surface px-4 py-2 text-sm text-fg-2 transition hover:text-fg"
      >
        Sign in with a different account
      </Link>
    </div>
  );
}
