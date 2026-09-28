import type { ReactNode } from 'react';
import type { ProductSizeOption } from '@/lib/product-sizes';
import { normalizeProductSizeLabel } from '@/lib/product-sizes';
import type { CoaRecord } from '@/lib/coa';
import type { BacWaterOption, BuyBoxProduct } from './BuyBox';
import CoaModule from './CoaModule';
import ProductDescription, { decodeProductEntities } from './ProductDescription';
import SizedProductControls from './SizedProductControls';
import TrustRow from './TrustRow';

interface SizedProductExperienceProps {
  product: BuyBoxProduct & { description?: string; shortDescription?: string };
  sizes: ProductSizeOption[];
  minorUnit: number;
  initialSize?: string;
  bacWater?: BacWaterOption | null;
  coa: CoaRecord | null;
  supplierEvidence?: ReactNode;
  copyHtml?: string;
  descriptorFallback?: string;
  guideSlug?: string;
  ratingSummary?: ReactNode;
  supportEmail?: string;
}

const textOnly = (value: string) => decodeProductEntities(value
  .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

/** Keep static details and document rendering out of the purchase JavaScript. */
export default function SizedProductExperience({
  product, sizes, minorUnit, initialSize, bacWater, coa, copyHtml, descriptorFallback,
  guideSlug, ratingSummary, supportEmail, supplierEvidence,
}: SizedProductExperienceProps) {
  const details = Object.fromEntries(sizes.map(selected => {
    const label = normalizeProductSizeLabel(selected.label);
    const descriptor = textOnly(selected.shortDescription ?? '')
      || (selected.slug === product.slug ? textOnly(product.shortDescription ?? '') || descriptorFallback : '')
      || `Selected supply: ${label} research vial.`;
    const detailHtml = selected.description
      || (selected.slug === product.slug ? product.description || copyHtml : '')
      || `<p>Detailed product copy is not currently published for the ${label} size. Use the selected supply details above and contact support with any identification questions.</p>`;
    return [selected.slug, (
    <section key={`details-${selected.slug}`} className="mt-10 grid gap-8 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <h2 className="mb-3 text-lg font-semibold text-fg">Product details · {label}</h2>
        {descriptor && !/HPLC-tested batch verification/i.test(descriptor) && <p className="mb-3 text-sm leading-relaxed text-muted">{descriptor}</p>}
        {guideSlug && <a href={`/learn/${guideSlug}`} className="mb-4 inline-flex min-h-11 items-center text-sm font-medium text-accent hover:underline">Read the {product.name} research overview →</a>}
        <ProductDescription html={detailHtml} />
      </div>
      <aside className="h-fit rounded-2xl border border-line bg-surface p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-fg">Purchase information</h3>
        <ul className="mt-3 space-y-3 text-sm text-muted">
          <li>Check certificate availability and confirm that any published record applies to the selected size and batch.</li>
          <li>Orders are prepared after payment confirmation. Shipping options appear at checkout.</li>
          <li><a href="/returns" className="text-accent hover:underline">Read returns and consumer guarantee information.</a></li>
        </ul>
        {supportEmail && <p className="mt-4 text-xs text-muted-2">Questions? <a href={`mailto:${supportEmail}`} className="text-accent">{supportEmail}</a></p>}
      </aside>
    </section>
    )];
  }));
  return <SizedProductControls
    product={{id:product.id,name:product.name,slug:product.slug,sku:product.sku,image:product.image}}
    sizes={sizes.map(size => ({...size,description:undefined,shortDescription:undefined}))}
    minorUnit={minorUnit} initialSize={initialSize} bacWater={bacWater}
    certificate={Boolean(coa)} historical={Boolean(supplierEvidence)} ratingSummary={ratingSummary}
    details={details}
    documentation={<>
      <div className="mt-10"><TrustRow /></div>
      <div id="product-documentation" className="mt-6 scroll-mt-28">{coa || !supplierEvidence ? <CoaModule record={coa} /> : supplierEvidence}</div>
    </>}
  />;
}
