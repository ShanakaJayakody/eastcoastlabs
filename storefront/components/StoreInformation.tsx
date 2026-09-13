import Link from 'next/link';
import type { ReactNode } from 'react';

export const storeInformationLinks = [
  ['/shipping','Shipping'],['/returns','Returns'],['/privacy','Privacy'],['/terms','Terms'],['/contact','Contact'],
] as const;

export default function StoreInformation({title,intro,children}:{title:string;intro:string;children:ReactNode}) {
  return <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
    <p className="text-xs font-semibold uppercase tracking-widest text-accent">Customer information</p>
    <h1 className="mt-3 text-3xl font-semibold tracking-tight text-fg">{title}</h1>
    <p className="mt-4 text-base leading-relaxed text-fg-2">{intro}</p>
    <article className="mt-8 space-y-7 text-sm leading-relaxed text-fg-2 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-fg [&_p+p]:mt-3 [&_a]:text-accent [&_a]:underline [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">{children}</article>
    <nav aria-label="Customer information" className="mt-10 flex flex-wrap gap-x-5 gap-y-3 border-t border-line pt-6 text-sm">
      {storeInformationLinks.map(([href,label])=><Link key={href} href={href} className="text-accent underline">{label}</Link>)}
    </nav>
  </div>;
}
