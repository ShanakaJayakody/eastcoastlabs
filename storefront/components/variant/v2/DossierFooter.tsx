import Link from "next/link";
import { RUO_TEXT } from "@/components/ResearchDisclaimer";

const COLUMNS = [
  {
    title: "Shop",
    links: [
      { href: "/shop", label: "All compounds" },
      { href: "/stacks", label: "Protocols" },
      { href: "/collections/recovery-repair", label: "Recovery & repair" },
    ],
  },
  {
    title: "Proof",
    links: [
      { href: "/lab-results", label: "Lab results & COAs" },
      { href: "/about", label: "About us" },
    ],
  },
  {
    title: "Correspondence",
    links: [{ href: "mailto:support@eastcoastlabs.com.au", label: "support@eastcoastlabs.com.au" }],
  },
];

/** Document colophon — closes the dossier the way a printed report would. */
export default function DossierFooter() {
  return (
    <footer className="border-t border-line bg-ink">
      <div className="mx-auto max-w-[1200px] px-6 py-14">
        <div className="grid gap-10 sm:grid-cols-3">
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="font-data text-[11px] uppercase tracking-[0.1em] text-muted-2">{col.title}</p>
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
          <p className="border border-warn/30 bg-warn/10 px-4 py-3 text-xs font-medium text-warn">
            {RUO_TEXT} Products are supplied strictly for laboratory research by qualified
            professionals. Nothing on this site is medical advice.
          </p>
          <p className="mt-4 font-data text-[11px] text-muted-2">
            © {new Date().getFullYear()} East Coast Labs · ABN [PENDING]
          </p>
        </div>
      </div>
    </footer>
  );
}
