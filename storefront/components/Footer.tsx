import Link from "next/link";
import ResearchDisclaimer from "./ResearchDisclaimer";
import EmailCapture from "./EmailCapture";

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-line bg-ink-2">
      <div className="mx-auto max-w-6xl px-4 py-12">
        {/* Newsletter */}
        <div className="mb-10 grid gap-5 rounded-2xl border border-line bg-surface/40 p-6 sm:grid-cols-2 sm:items-center sm:p-8">
          <div>
            <p className="text-lg font-semibold text-fg">Restock alerts &amp; new compounds</p>
            <p className="mt-1 text-sm text-muted">
              Be first to know when a batch is back in stock or a new research compound drops.
            </p>
          </div>
          <EmailCapture source="footer" cta="Subscribe" successMsg="✓ Subscribed — watch your inbox." />
        </div>

        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <p className="text-sm font-semibold tracking-[0.18em] text-fg">EAST COAST LABS</p>
            <p className="mt-3 max-w-sm text-sm text-muted">
              Australian owned &amp; operated supplier of research-use-only peptides. Every batch
              independently tested by JanoShik, with the Certificate of Analysis published before it
              ships.
            </p>
            <p className="mt-4 text-sm text-fg-2">Australian owned &amp; operated</p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-2">Explore</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link href="/shop" className="text-fg-2 hover:text-accent">Shop</Link></li>
              <li><Link href="/lab-results" className="text-fg-2 hover:text-accent">Lab Results</Link></li>
              <li><Link href="/about" className="text-fg-2 hover:text-accent">About</Link></li>
              <li><Link href="/cart" className="text-fg-2 hover:text-accent">Cart</Link></li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-2">Support</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <a href="mailto:support@eastcoastlabs.com.au" className="text-fg-2 hover:text-accent">
                  support@eastcoastlabs.com.au
                </a>
              </li>
              <li className="text-muted">ABN: [PENDING]</li>
              <li className="text-muted">Mon–Fri, 9am–5pm AEST</li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-line pt-6">
          <ResearchDisclaimer variant="badge" />
          <p className="mt-4 text-xs text-muted-2">
            All products supplied by East Coast Labs are intended for laboratory research use only.
            They are not intended for human consumption, therapeutic use, diagnosis, or veterinary
            application. We do not provide dosing information or administration guidance.
          </p>
          <p className="mt-4 text-xs text-muted-2">
            © {new Date().getFullYear()} East Coast Labs. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
