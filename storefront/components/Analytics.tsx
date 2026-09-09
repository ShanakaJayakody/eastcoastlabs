"use client";
import Script from "next/script";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useReportWebVitals } from "next/web-vitals";
import { GA4_ID } from "@/lib/env";
import { analyticsAllowed, flushAnalytics, ga4Enabled, safeAnalyticsLocation, trackPageView, trackWebVital } from "@/lib/analytics";

export default function Analytics() {
  const pathname = usePathname();
  const allowed = ga4Enabled() && analyticsAllowed(pathname);
  useReportWebVitals(trackWebVital);
  useEffect(() => {
    (window as unknown as Record<string,unknown>)[`ga-disable-${GA4_ID}`] = !allowed;
    if (!allowed) return;
    const location = safeAnalyticsLocation(window.location.href);
    if (!location) return;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || ((...args) => { window.dataLayer!.push(args); });
    window.gtag("js",new Date());
    window.gtag("config",GA4_ID,{send_page_view:false,page_location:location,page_referrer:"",ignore_referrer:true,allow_google_signals:false,allow_ad_personalization_signals:false});
    flushAnalytics();
    trackPageView();
  },[allowed,pathname]);
  if (!allowed) return null;
  return <Script id="ga4-loader" src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA4_ID)}`} strategy="afterInteractive" referrerPolicy="no-referrer" onReady={flushAnalytics}/>;
}
