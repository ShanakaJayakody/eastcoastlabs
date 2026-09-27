/**
 * Fonts scoped to the creator pages via CSS variables on their root element.
 * Bundle Inter and Newsreader so their Google delivery URLs cannot break builds.
 */
import { IBM_Plex_Mono } from "next/font/google";
import localFont from "next/font/local";

export const newsreader = localFont({
  src: [
    { path: "../public/fonts/newsreader-normal-latin.woff2", weight: "400 500", style: "normal" },
    { path: "../public/fonts/newsreader-variable-italic-latin.woff2", weight: "400 500", style: "italic" },
  ],
  adjustFontFallback: "Times New Roman",
  variable: "--font-serif",
  display: "swap",
});

export const inter = localFont({
  src: "../public/fonts/inter-latin.woff2",
  weight: "400 600",
  variable: "--font-grotesk",
  display: "swap",
});

export const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-data",
  display: "swap",
});
