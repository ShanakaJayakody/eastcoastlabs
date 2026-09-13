"use client";
import Script from "next/script";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useReportWebVitals } from "next/web-vitals";
import { GA4_ID } from "@/lib/env";
import { analyticsAllowed, flushAnalytics, ga4Enabled, safeAnalyticsLocation, trackPageView, trackWebVital } from "@/lib/analytics";
import { ANALYTICS_CONSENT_EVENT, analyticsConsent, captureAcquisition, type AnalyticsConsent } from "@/lib/attribution";
import AnalyticsConsentControls from "@/components/AnalyticsConsentControls";

export default function Analytics() {
  const pathname = usePathname();
  const [consent, setConsent] = useState<AnalyticsConsent | null>(null);
  const [consentReady, setConsentReady] = useState(false);
  const routeAllowed = ga4Enabled() && analyticsAllowed(pathname);
  const allowed = routeAllowed && consent === "granted";
  useReportWebVitals(trackWebVital);
  useEffect(() => {
    setConsent(analyticsConsent());setConsentReady(true);
    const changed=(event:Event)=>setConsent((event as CustomEvent<AnalyticsConsent>).detail);
    window.addEventListener(ANALYTICS_CONSENT_EVENT,changed);return()=>window.removeEventListener(ANALYTICS_CONSENT_EVENT,changed);
  }, []);
  useEffect(() => {
    (window as unknown as Record<string,unknown>)[`ga-disable-${GA4_ID}`] = !allowed;
    if (!allowed) return;
    const location = safeAnalyticsLocation(window.location.href);
    if (!location) return;
    captureAcquisition(window.location.href);
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || ((...args) => { window.dataLayer!.push(args); });
    window.gtag("js",new Date());
    window.gtag("config",GA4_ID,{send_page_view:false,page_location:location,page_referrer:"",ignore_referrer:true,allow_google_signals:false,allow_ad_personalization_signals:false});
    flushAnalytics();
    trackPageView();
  },[allowed,pathname]);
  return <>
    {allowed && <Script id="ga4-loader" src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA4_ID)}`} strategy="afterInteractive" referrerPolicy="no-referrer" onReady={flushAnalytics}/>}
    {consentReady && routeAllowed && consent === null && <section role="region" aria-label="Analytics choices" className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-2xl rounded-xl border border-line-2 bg-ink-2 p-4 shadow-2xl">
      <p className="text-sm text-fg-2">Optional analytics helps us improve the shop and checkout. We do not send full URLs, referrers or contact details.</p>
      <AnalyticsConsentControls showStatus={false}/>
    </section>}
  </>;
}
