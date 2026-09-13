'use client';

import dynamic from 'next/dynamic';

// Optional measurement and exit-intent UI do not belong in the initial purchase
// bundle. Their own consent, public-route and interaction guards remain intact.
const Analytics = dynamic(() => import('./Analytics'), { ssr: false });
const ExitIntentModal = dynamic(() => import('./ExitIntentModal'), { ssr: false });

export default function StoreEnhancements({ exitIntent = true }: { exitIntent?: boolean }) {
  return <><Analytics />{exitIntent && <ExitIntentModal />}</>;
}
