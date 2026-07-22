/**
 * Markdown copy loader.
 *
 * Reads the compliance-checked copy decks bundled in /content (synced from the
 * project's /docs) and parses the fields the storefront renders. All product
 * copy comes from these files — nothing is invented here. Server-side only.
 */

import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { marked } from "marked";

marked.setOptions({ gfm: true, breaks: false });

const CONTENT_DIR = path.join(process.cwd(), "content");
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const cache = new Map<string, string>();
async function readDoc(file: string): Promise<string> {
  if (cache.has(file)) return cache.get(file)!;
  try {
    const text = await fs.readFile(path.join(CONTENT_DIR, file), "utf8");
    cache.set(file, text);
    return text;
  } catch (err) {
    console.warn(`[content] failed to read ${file}:`, err instanceof Error ? err.message : err);
    cache.set(file, "");
    return "";
  }
}

function slice(md: string, startHeading: string): string {
  const start = md.indexOf(startHeading);
  if (start === -1) return "";
  const rest = md.slice(start + startHeading.length);
  const nextH = rest.search(/\n#{1,3} /);
  return nextH === -1 ? rest : rest.slice(0, nextH);
}

function firstMatch(md: string, re: RegExp): string {
  const m = md.match(re);
  return m ? m[1].trim() : "";
}

// ---------- Homepage copy ----------

export interface HomeCopy {
  heroH1: string;
  heroSub: string;
  proofHeading: string;
  proofSupport: string;
  bestsellersHeading: string;
  bestsellersIntro: string;
  steps: { title: string; body: string }[];
  restockHeading: string;
  restockBody: string;
  faq: { q: string; a: string }[];
}

export async function getHomeCopy(): Promise<HomeCopy> {
  const md = await readDoc("HOMEPAGE_PDP_COPY.md");

  const heroBlock = slice(md, "### Hero Section");
  const proofBlock = slice(md, "### Live Batch Proof Strip");
  const bestBlock = slice(md, "### Bestsellers Section");
  const restockBlock = slice(md, "### Restock Program Promo");
  const faqBlock = slice(md, "### FAQ Section");

  const steps: { title: string; body: string }[] = [];
  const stepRe = /\*\*Step \d+ — (.+?)\*\*\s*\n+([^\n]+)/g;
  for (let m = stepRe.exec(md); m; m = stepRe.exec(md)) {
    steps.push({ title: m[1].trim(), body: m[2].trim() });
  }

  const faq: { q: string; a: string }[] = [];
  const faqRe = /\*\*Q:\s*(.+?)\*\*\s*\n+([^\n]+)/g;
  for (let m = faqRe.exec(faqBlock); m; m = faqRe.exec(faqBlock)) {
    faq.push({ q: m[1].trim(), a: m[2].trim() });
  }

  return {
    heroH1: firstMatch(heroBlock, /\*\*H1:\*\*\s*(.+)/) || "Lab-grade peptides. Independently tested. Proof published.",
    heroSub: firstMatch(heroBlock, /\*\*Subheadline:\*\*\s*(.+)/),
    proofHeading: firstMatch(proofBlock, /\*\*Section heading:\*\*\s*(.+)/),
    proofSupport: firstMatch(proofBlock, /\*\*Supporting text:\*\*\s*(.+)/),
    bestsellersHeading: firstMatch(bestBlock, /\*\*Section heading:\*\*\s*(.+)/),
    bestsellersIntro: firstMatch(bestBlock, /\*\*Section intro:\*\*\s*(.+)/),
    steps,
    restockHeading: firstMatch(restockBlock, /\*\*Heading:\*\*\s*(.+)/),
    restockBody: firstMatch(restockBlock, /\*\*Body:\*\*\s*(.+)/),
    faq,
  };
}

// ---------- Product descriptions ----------

export interface ProductCopy {
  /** Fact-led one-paragraph descriptor (the "Opening:" line). */
  descriptor: string;
  /** Full rendered description section as HTML. */
  html: string;
}

let descSections: { name: string; body: string }[] | null = null;
async function loadDescSections() {
  if (descSections) return descSections;
  const md = await readDoc("PRODUCT_DESCRIPTIONS.md");
  const chunks = md.split(/\n## /).slice(1); // drop preamble
  descSections = chunks
    .map((chunk) => {
      const nl = chunk.indexOf("\n");
      const heading = chunk.slice(0, nl).trim();
      // heading like "1. KLOW — $149.99/vial" or "Before/After Example: BPC-157"
      const nameMatch = heading.replace(/^\d+\.\s*/, "").split("—")[0].trim();
      return { name: nameMatch, body: chunk.slice(nl + 1).trim() };
    })
    .filter((s) => s.name && !/before\/after/i.test(s.name));
  return descSections;
}

async function findSection(productName: string, productSlug?: string) {
  const sections = await loadDescSections();
  const n = normalize(productName);
  const s = productSlug ? normalize(productSlug) : "";
  return (
    sections.find((sec) => {
      const c = normalize(sec.name);
      return c === n || c === s || c.includes(n) || n.includes(c) || (s !== "" && (c.includes(s) || s.includes(c)));
    }) ?? null
  );
}

/** Rendered copy for a product, or null when no matching section exists. */
export async function getProductCopy(productName: string, productSlug?: string): Promise<ProductCopy | null> {
  const section = await findSection(productName, productSlug);
  if (!section) return null;
  const descriptor = firstMatch(section.body, /\*\*Opening:\*\*\s*(.+)/);
  const html = await marked.parse(section.body);
  return { descriptor: descriptor.trim(), html };
}

// ---------- About page ----------

export async function getAboutHtml(): Promise<string> {
  let md = await readDoc("ABOUT_PAGE_COPY.md");
  // Owner-input placeholders render as an explicit pending marker.
  md = md
    .replace(/\[OWNER INPUT: Provide Australian Business Number\]/g, "[PENDING]")
    .replace(/\*\*\[OWNER INPUT:[^\]]*\]\*\*/g, "")
    .replace(/\[OWNER INPUT:[^\]]*\]/g, "[PENDING]");
  return marked.parse(md);
}
