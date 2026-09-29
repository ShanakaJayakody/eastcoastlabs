import { getCatalog, rankAvailableProductsByPopularity } from "@/lib/catalog";
import { getAllCoa } from "@/lib/coa";
import { getCollections } from "@/lib/collections";
import { getSettings } from "@/lib/settings";
import { decorateCards } from "@/lib/storefront-catalog";
import { labReports } from "@/lib/lab-reports";
import RebrandExperience from "./RebrandExperience";
import NavyFooter from './NavyFooter';
import { availablePaymentOptions } from '@/lib/payments';
import { withRebrandImages } from '@/lib/rebrand-imagery';
import { getHomeCopy } from '@/lib/content';
import { questions } from './content';

export default async function RebrandPage({
  variant,
}: {
  variant: "v2";
}) {
  const [catalog, records, settings, copy] = await Promise.all([
    getCatalog(),
    getAllCoa(),
    getSettings(),
    getHomeCopy(),
  ]);
  const products = await decorateCards(
    rankAvailableProductsByPopularity(catalog.products),
  );
  return (
    <RebrandExperience
      variant={variant}
      products={products.map(product => withRebrandImages(product, variant))}
      collections={getCollections()}
      records={records.slice(0, 3)}
      report={labReports.find((report) => report.productSlug === "ghk-cu")!}
      productReports={labReports.map(({ productSlug, image, testDate, sample }) => ({ productSlug, image, testDate, sample }))}
      reportCount={labReports.length}
      supportEmail={settings.supportEmail}
      paymentLabels={availablePaymentOptions(settings).map(option => option.label)}
      supportHours={settings.supportHours}
      legalName={settings.legalName}
      abn={settings.abn}
      faq={copy.faq.length ? copy.faq : questions}
    >
      <NavyFooter collections={getCollections()} supportEmail={settings.supportEmail} supportHours={settings.supportHours} legalName={settings.legalName} abn={settings.abn} />
    </RebrandExperience>
  );
}
