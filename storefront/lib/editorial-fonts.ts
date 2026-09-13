import localFont from "next/font/local";

export const editorialSans = localFont({
  src: "../public/fonts/inter-latin.woff2",
  weight: "400 600",
  variable: "--font-grotesk",
  display: "swap",
});

export const editorialSerif = localFont({
  src: "../public/fonts/newsreader-italic-latin.woff2",
  weight: "400",
  style: "italic",
  variable: "--font-serif",
  display: "swap",
});
