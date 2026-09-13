import localFont from "next/font/local";

export const brandBody = localFont({
  src: "../public/fonts/commissioner-latin.woff2",
  weight: "400 700",
  variable: "--font-brand-body",
  display: "swap",
});

export const brandDisplay = localFont({
  src: "../public/fonts/tenor-sans-latin.woff2",
  weight: "400",
  style: "normal",
  variable: "--font-brand-display",
  display: "swap",
});
