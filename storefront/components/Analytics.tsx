import Script from "next/script";
import { GA4_ID } from "@/lib/env";

/**
 * GA4 loader. Renders nothing (and injects no scripts) when the env var is
 * unset, so the storefront runs cleanly with no analytics configured. Email
 * lifecycle runs natively on Resend — no marketing-platform script needed.
 */
export default function Analytics() {
  return (
    <>
      {GA4_ID !== "" && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA4_ID}');`}
          </Script>
        </>
      )}
    </>
  );
}
