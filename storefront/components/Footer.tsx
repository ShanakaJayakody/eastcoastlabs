import MarketingOnly from "./MarketingOnly";
import Link from "next/link";
import Image from "next/image";
import ResearchDisclaimer from "./ResearchDisclaimer";
import EmailCapture from "./EmailCapture";
import { getCollections } from "@/lib/collections";

export default function Footer({ supportEmail = "eclpeptides@gmail.com",legalName,abn,supportHours="Mon–Fri, 9am–5pm AEST" }: { supportEmail?: string;legalName?:string;abn?:string;supportHours?:string }) {
  const collections = getCollections();
  return (
    <footer className="ecl-footer mt-20 border-t border-line bg-ink-2">
      <div className="ecl-container mx-auto max-w-6xl px-4 py-12">
        {/* Newsletter */}
        <MarketingOnly><div className="ecl-newsletter mb-10 grid gap-5 rounded-2xl border border-line bg-surface/40 p-6 sm:grid-cols-2 sm:items-center sm:p-8">
          <div>
            <p className="ecl-eyebrow">THE NEXT CHAPTER</p>
            <p className="ecl-newsletter-title text-lg font-semibold text-fg">Stay curious. <em>Stay informed.</em></p>
            <p className="mt-1 text-sm text-muted">
              Be first to know when a batch is back in stock or a new research compound drops.
            </p>
          </div>
          <EmailCapture source="footer" cta="Subscribe" successMsg="✓ Subscribed — watch your inbox." />
        </div>

        </MarketingOnly>
        <div className="grid gap-10 md:grid-cols-4 lg:grid-cols-5">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5">
              <Image src="/logo.png" alt="East Coast Labs" width={34} height={36} unoptimized className="h-8 w-auto" />
              <p className="text-sm font-semibold tracking-[0.18em] text-fg">EAST COAST LABS</p>
            </div>
            <p className="mt-3 max-w-sm text-sm text-muted">
              Australian supplier of research-use-only peptides. Browse available batch documentation on our Lab Results page.
            </p>
            <p className="mt-4 text-sm text-fg-2">Australian owned &amp; operated</p>
            {legalName&&<p className="mt-2 text-xs text-muted">{legalName}</p>}
            {abn&&<p className="mt-1 text-xs text-muted">ABN {abn}</p>}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-2">Explore</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link href="/shop" className="text-fg-2 hover:text-accent">Shop</Link></li>
              <li><Link href="/stacks" className="text-fg-2 hover:text-accent">Research Stacks</Link></li>
              <li><Link href="/lab-results" className="text-fg-2 hover:text-accent">Lab Results</Link></li>
              <li><Link href="/learn" className="text-fg-2 hover:text-accent">Research Hub</Link></li>
              <li><Link href="/creators" className="text-fg-2 hover:text-accent">Creators</Link></li>
              <li><Link href="/about" className="text-fg-2 hover:text-accent">About</Link></li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-2">By research goal</p>
            <ul className="mt-3 space-y-2 text-sm">
              {collections.map((c) => (
                <li key={c.slug}>
                  <Link href={`/collections/${c.slug}`} className="text-fg-2 hover:text-accent">
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-2">Support</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <a href={`mailto:${supportEmail}`} className="text-fg-2 hover:text-accent">
                  {supportEmail}
                </a>
              </li>
              {supportHours&&<li className="text-muted">{supportHours}</li>}
              <li><Link href="/contact" className="text-fg-2 hover:text-accent">Contact and business details</Link></li>
              <li><Link href="/shipping" className="text-fg-2 hover:text-accent">Shipping and payment</Link></li>
              <li><Link href="/returns" className="text-fg-2 hover:text-accent">Returns and order problems</Link></li>
              <li><Link href="/privacy" className="text-fg-2 hover:text-accent">Privacy</Link></li>
              <li><Link href="/terms" className="text-fg-2 hover:text-accent">Purchase terms</Link></li>
            </ul>
          </div>
        </div>

        <p className="ecl-footer-wordmark" aria-hidden="true">EAST COAST LABS</p>
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
