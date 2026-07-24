/**
 * Guides / education hub loader.
 *
 * Guides are markdown files in content/guides/ with a simple `---` frontmatter
 * block. Server-only (reads from disk). Powers the /learn hub, /learn/[slug]
 * article pages, the sitemap, and product↔guide cross-links.
 */

import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { marked } from "marked";

marked.setOptions({ gfm: true, breaks: false });

const DIR = path.join(process.cwd(), "content", "guides");

export interface GuideMeta {
  slug: string;
  title: string;
  description: string;
  category: string; // "Fundamentals" | "Compound"
  compounds: string[]; // product slugs this guide covers (may be empty)
  readMins: number;
  updated: string; // ISO yyyy-mm-dd
}

export interface Guide extends GuideMeta {
  html: string;
}

function parseFrontmatter(raw: string): { data: Record<string, string>; body: string } {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: raw };
  const data: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx > 0) data[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return { data, body: m[2] };
}

function toMeta(slug: string, data: Record<string, string>): GuideMeta {
  return {
    slug,
    title: data.title ?? slug,
    description: data.description ?? "",
    category: data.category ?? "Guide",
    compounds: (data.compound ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    readMins: Number(data.readMins) || 4,
    updated: data.updated ?? "",
  };
}

async function listSlugs(): Promise<string[]> {
  try {
    return (await fs.readdir(DIR)).filter((f) => f.endsWith(".md")).map((f) => f.replace(/\.md$/, ""));
  } catch {
    return [];
  }
}

const CATEGORY_ORDER: Record<string, number> = { Fundamentals: 0, Compound: 1 };

/** All guide metadata, Fundamentals first then compounds, alpha within group. */
export async function getGuides(): Promise<GuideMeta[]> {
  const slugs = await listSlugs();
  const metas = await Promise.all(
    slugs.map(async (slug) => {
      const raw = await fs.readFile(path.join(DIR, `${slug}.md`), "utf8");
      return toMeta(slug, parseFrontmatter(raw).data);
    }),
  );
  return metas.sort((a, b) => {
    const c = (CATEGORY_ORDER[a.category] ?? 9) - (CATEGORY_ORDER[b.category] ?? 9);
    return c !== 0 ? c : a.title.localeCompare(b.title);
  });
}

/** A single rendered guide, or null when the slug does not exist. */
export async function getGuide(slug: string): Promise<Guide | null> {
  const raw = await fs.readFile(path.join(DIR, `${slug}.md`), "utf8").catch(() => null);
  if (!raw) return null;
  const { data, body } = parseFrontmatter(raw);
  const html = await marked.parse(body);
  return { ...toMeta(slug, data), html };
}

/** The guide that covers a given product slug (for the PDP cross-link). */
export async function getGuideForCompound(productSlug: string): Promise<GuideMeta | null> {
  return (await getGuides()).find((g) => g.compounds.includes(productSlug)) ?? null;
}
