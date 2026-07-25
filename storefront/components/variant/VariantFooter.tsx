import Link from "next/link";
import { RUO_TEXT } from "@/components/ResearchDisclaimer";

const COLUMNS = [
  {
    title: "Shop",
    links: [
      { href: "/shop", label: "All peptides" },
      { href: "/stacks", label: "Research stacks" },
      { href: "/collections/recovery-repair", label: "Recovery & repair" },
      { href: "/collections/metabolic-weight", label: "Metabolic" },
    ],
  },
  {
    title: "Proof",
    links: [
      { href: "/lab-results", label: "Lab results & COAs" },
      { href: "/learn", label: "Research library" },
      { href: "/about", label: "About us" },
    ],
  },
];

/** Light footer for the /1 variant. Compliance line is non-negotiable. */
export default function VariantFooter() {
  return (
    <footer className="mt-20 border-t border-line bg-surface-2">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <p className="text-sm font-semibold text-fg">East Coast Labs</p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
              Australian-owned supplier of research-use-only peptides. Every batch is
              independently tested by JanoShik and the certificate of analysis is published
              before the product is listed.
            </p>
            <p className="mt-4 text-sm text-muted">
              <a href="mailto:support@eastcoastlabs.com.au" className="link-sweep text-accent">
                support@eastcoastlabs.com.au
              </a>
            </p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-2">{col.title}</p>
              <ul className="mt-3 space-y-2">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-sm text-fg-2 transition hover:text-accent">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 border-t border-line pt-6">
          <p className="rounded-lg border border-warn/30 bg-warn/10 px-4 py-3 text-xs font-medium text-warn">
            ⚠ {RUO_TEXT} Products are supplied strictly for laboratory research by qualified
            professionals. Nothing on this site is medical advice.
          </p>
          <p className="mt-4 text-xs text-muted-2">
            © {new Date().getFullYear()} East Coast Labs. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
