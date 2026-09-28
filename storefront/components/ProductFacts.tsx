import PurchaseIcon from './PurchaseIcon';

export default function ProductFacts({ available, certificate, historical, sizeLabel }: {
  available: boolean; certificate: boolean; historical: boolean; sizeLabel?: string;
}) {
  const scope = sizeLabel ? `the selected ${sizeLabel} supply` : 'this supply';
  return <div className="space-y-2 text-xs text-muted">
    <ul aria-label="Product facts" className="flex flex-wrap gap-x-4 gap-y-2">
      <li className="flex items-center gap-1.5"><PurchaseIcon name="stock" />{available ? 'In stock' : 'Out of stock'}</li>
      <li className="flex items-center gap-1.5"><PurchaseIcon name="vial" />{sizeLabel ? `${sizeLabel} per vial` : 'Research supply'}</li>
      <li><a href="#product-documentation" className="flex items-center gap-1.5 underline underline-offset-4 hover:text-fg"><PurchaseIcon name="document" />{certificate ? 'Product certificate' : historical ? 'Historical supplier report' : 'Documentation status'}</a></li>
    </ul>
    <p>{certificate
      ? `Product-level certificate; not linked to ${scope} or your shipment batch.`
      : `No verified certificate is currently published for ${scope}.`}</p>
  </div>;
}
