/**
 * Fonts for the /1 "Dossier" variant only. The control site (`/`) stays on
 * system fonts (see globals.css `--font-sans`) — these are scoped to the
 * variant layout via CSS variables on its root element, never touching `/`.
 */
import { Newsreader, Inter, IBM_Plex_Mono } from "next/font/google";

export const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

export const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-grotesk",
  display: "swap",
});

export const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-data",
  display: "swap",
});
