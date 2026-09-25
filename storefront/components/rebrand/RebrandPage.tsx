import { getCatalog, rankAvailableProductsByPopularity } from "@/lib/catalog";
import { getAllCoa } from "@/lib/coa";
import { getCollections } from "@/lib/collections";
import { getSettings } from "@/lib/settings";
import { decorateCards } from "@/lib/storefront-catalog";
import { labReports } from "@/lib/lab-reports";
import RebrandExperience from "./RebrandExperience";
import type { RebrandVariant } from "./content";
import { withRebrandImages } from '@/lib/rebrand-imagery';

export default async function RebrandPage({
  variant,
}: {
  variant: RebrandVariant;
}) {
  const [catalog, records, settings] = await Promise.all([
    getCatalog(),
    getAllCoa(),
    getSettings(),
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
      supportHours={settings.supportHours}
      legalName={settings.legalName}
      abn={settings.abn}
    />
  );
}
