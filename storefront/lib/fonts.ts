/**
 * Fonts scoped to the creator pages via CSS variables on their root element.
 * Use the bundled Inter font so its Google delivery URL cannot break builds.
 */
import { Newsreader, IBM_Plex_Mono } from "next/font/google";
import localFont from "next/font/local";

export const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
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
