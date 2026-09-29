import type { Metadata, Viewport } from "next";
import Providers from "@/components/Providers";
import { getSettings } from "@/lib/settings";
import { shippingRules } from '@/lib/shipping-policy';
import { availablePaymentOptions } from '@/lib/payments';
import {
  getUpsellStock,
  getCartPrices,
  getCartVariants,
} from "@/lib/storefront-catalog";
import "@/components/rebrand/rebrand.css";

export const metadata: Metadata = {
  robots: { index: false, follow: true },
  alternates: { canonical: "/" },
};
export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#112b43",
};

/** Independent visual shell; prices, inventory and checkout remain shared. */
export default async function VariantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [settings, stock, prices, variants] = await Promise.all([
    getSettings(),
    getUpsellStock(),
    getCartPrices(),
    getCartVariants(),
  ]);
  return (
    <Providers
      thresholds={{
        freeShipping: settings.freeShippingThreshold,
        gift: settings.giftThreshold,
        express: settings.expressShippingEnabled ? settings.expressFreeThreshold : undefined,
      }}
      stock={stock}
      prices={prices}
      variants={variants}
      shipping={shippingRules(settings)}
      paymentLabels={availablePaymentOptions(settings).map(option => option.label)}
    >
      {children}
    </Providers>
  );
}
