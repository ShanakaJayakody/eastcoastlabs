/**
 * COA (Certificate of Analysis) client.
 *
 * Primary source: custom WooCommerce endpoint GET {BASE}/wp-json/ecl/v1/coa
 * (and /coa/{id}). That endpoint is NOT deployed yet — it 404s against live —
 * so every read degrades gracefully to the local CSV fixture
 * (data/coa-seed.csv) and NEVER throws. Once the plugin ships, live data takes
 * over automatically with no code change.
 *
 * Runs server-side only (reads the fixture from disk with fs).
 */

import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { WOO_API_BASE } from "./env";

export interface CoaRecord {
  batch_id: string;
  compound: string;
  purity_pct: number;
  lab: string;
  test_date: string; // ISO yyyy-mm-dd
  coa_url: string;
  lab_verify_url: string;
}

const COA_API = `${WOO_API_BASE}/wp-json/ecl/v1/coa`;
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// ---------- CSV fixture ----------

let fixtureCache: CoaRecord[] | null = null;

function parseCsv(csv: string): CoaRecord[] {
  const lines = csv.trim().split(/\r?\n/);
  const header = lines[0].split(",").map((h) => h.trim());
  const idx = (name: string) => header.indexOf(name);
  const rows: CoaRecord[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    if (cols.length < header.length) continue;
    rows.push({
      batch_id: cols[idx("batch_id")].trim(),
      compound: cols[idx("compound")].trim(),
      purity_pct: parseFloat(cols[idx("purity_pct")]),
      lab: cols[idx("lab")].trim(),
      test_date: cols[idx("test_date")].trim(),
      coa_url: cols[idx("coa_url")].trim(),
      lab_verify_url: cols[idx("lab_verify_url")].trim(),
    });
  }
  return rows;
}

async function loadFixture(): Promise<CoaRecord[]> {
  if (fixtureCache) return fixtureCache;
  try {
    const file = path.join(process.cwd(), "data", "coa-seed.csv");
    const csv = await fs.readFile(file, "utf8");
    fixtureCache = parseCsv(csv);
  } catch (err) {
    console.warn("[coa] fixture load failed:", err instanceof Error ? err.message : err);
    fixtureCache = [];
  }
  return fixtureCache;
}

// ---------- Live endpoint (with graceful fallback) ----------

function coerceRecords(data: unknown): CoaRecord[] | null {
  if (!Array.isArray(data)) return null;
  const records = data
    .map((r): CoaRecord | null => {
      if (!r || typeof r !== "object") return null;
      const o = r as Record<string, unknown>;
      if (o.batch_id == null || o.purity_pct == null) return null;
      return {
        batch_id: String(o.batch_id),
        compound: String(o.compound ?? o.product ?? o.name ?? ""),
        purity_pct: Number(o.purity_pct),
        lab: String(o.lab ?? ""),
        test_date: String(o.test_date ?? ""),
        coa_url: String(o.coa_url ?? ""),
        lab_verify_url: String(o.lab_verify_url ?? ""),
      };
    })
    .filter((r): r is CoaRecord => r !== null);
  return records.length > 0 ? records : null;
}

/**
 * All published COA rows. Tries the live endpoint first; on 404 / error / empty
 * it falls back to the CSV fixture. Never throws.
 */
export async function getAllCoa(): Promise<CoaRecord[]> {
  try {
    const res = await fetch(COA_API, {
      headers: { Accept: "application/json" },
      next: { revalidate: 300 },
    });
    if (res.ok) {
      const live = coerceRecords(await res.json());
      if (live) return sortByDateDesc(live);
    } else {
      console.warn(`[coa] live endpoint HTTP ${res.status} — using fixture`);
    }
  } catch (err) {
    console.warn("[coa] live endpoint unreachable — using fixture:", err instanceof Error ? err.message : err);
  }
  return sortByDateDesc(await loadFixture());
}

function sortByDateDesc(records: CoaRecord[]): CoaRecord[] {
  return [...records].sort((a, b) => (a.test_date < b.test_date ? 1 : -1));
}

/** Most-recently-tested COA rows for the homepage proof strip. */
export async function getLatestCoa(limit = 6): Promise<CoaRecord[]> {
  return (await getAllCoa()).slice(0, limit);
}

/**
 * Best-matching COA for a product, matched by compound-name substring
 * (either direction). Returns null when there is no match (e.g. Bacteriostatic
 * Water) so the PDP can omit the COA module cleanly.
 */
export async function getCoaForProduct(productName: string, productSlug?: string): Promise<CoaRecord | null> {
  const all = await getAllCoa();
  const n = normalize(productName);
  const s = productSlug ? normalize(productSlug) : "";
  let best: CoaRecord | null = null;
  for (const r of all) {
    const c = normalize(r.compound);
    if (!c) continue;
    if (c === n || c === s || c.includes(n) || n.includes(c) || (s && (c.includes(s) || s.includes(c)))) {
      best = r;
      break;
    }
  }
  return best;
}
