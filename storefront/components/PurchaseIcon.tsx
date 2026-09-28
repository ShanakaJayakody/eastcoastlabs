/** Small, decorative icons for the product facts and purchase information. */
export default function PurchaseIcon({ name, className = '' }: {
  name: 'stock' | 'vial' | 'document' | 'shipping' | 'payment'; className?: string;
}) {
  const paths = {
    stock: 'M9 12l2 2 4-4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    vial: 'M9 3h6M9 3v5l-2 3v9a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-9l-2-3V3M7 13h10',
    document: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm0 0v6h6M8 13h8M8 17h8',
    shipping: 'M3 17H1V5h13v12H7M14 9h4l4 4v4h-3M7 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm12 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z',
    payment: 'M4 7h16l-4-4M20 17H4l4 4M20 7l-4 4M4 17l4-4',
  };
  return <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`}><path d={paths[name]} /></svg>;
}
