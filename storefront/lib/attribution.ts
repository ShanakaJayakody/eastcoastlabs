/** Privacy-bounded first-party measurement state. No email, referrer, query,
 * address or arbitrary URL value is accepted into this cookie or an order. */
export const ANALYTICS_CONSENT_COOKIE = "ecl_analytics_consent";
export const MEASUREMENT_COOKIE = "ecl_measurement";
export const ANALYTICS_CONSENT_EVENT = "ecl:analytics-consent";

export type AnalyticsConsent = "granted" | "denied";
export interface AcquisitionAttribution {
  source: string;
  medium?: string;
  campaign?: string;
  landingPath: string;
}
export interface ExperimentAssignment { experimentId: string; variant: string; }
export interface OrderAttribution { acquisition?: AcquisitionAttribution; experiments: ExperimentAssignment[]; }

const MAX_AGE_SECONDS = 120 * 24 * 60 * 60;
const IDENTIFIER = /^[a-z0-9][a-z0-9._~-]{0,63}$/;
const SOURCES = new Set(["google","bing","newsletter","creator","affiliate","instagram","facebook"]);
const MEDIUMS = new Set(["cpc","paid-search","email","social","affiliate","organic"]);
const PUBLIC_PATH = /^(?:\/|\/1|\/(?:shop|stacks|lab-results|learn|about|checkout|creators)|\/(?:product|collections|learn)\/[a-z0-9-]+)\/?$/;
export const publicMeasurementPath = (path: string) => PUBLIC_PATH.test(path);

function exactKeys(value: Record<string, unknown>, keys: readonly string[]) { return Object.keys(value).every((key) => keys.includes(key)); }
function record(value: unknown): Record<string, unknown> | null { return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function identifier(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return IDENTIFIER.test(normalized) ? normalized : null;
}
function configuredCampaigns() { return new Set((process.env.NEXT_PUBLIC_MEASUREMENT_CAMPAIGNS??"").split(",").map((value)=>identifier(value)).filter((value):value is string=>Boolean(value))); }
function configuredExperiments() {
  const configured=new Map<string,Set<string>>();
  for(const declaration of (process.env.NEXT_PUBLIC_MEASUREMENT_EXPERIMENTS??"").split(",")){
    const [rawId,rawVariants,extra]=declaration.split(":");const id=identifier(rawId);if(!id||!rawVariants||extra!==undefined)continue;
    const variants=rawVariants.split("|").map((value)=>identifier(value)).filter((value):value is string=>Boolean(value));
    if(variants.length>=2&&variants.length<=8&&new Set(variants).size===variants.length)configured.set(id,new Set(variants));
  }
  return configured;
}

export function parseOrderAttribution(raw: string | null | undefined, consent: string | null | undefined = "granted"): OrderAttribution | null {
  if (consent !== "granted" || !raw || raw.length > 4096) return null;
  try {
    const root = record(JSON.parse(decodeURIComponent(raw)));
    if (!root || !exactKeys(root, ["acquisition", "experiments"]) || !Array.isArray(root.experiments) || root.experiments.length > 8) return null;
    const experiments: ExperimentAssignment[] = [];
    for (const input of root.experiments) {
      const item = record(input);
      if (!item || !exactKeys(item, ["experimentId", "variant"])) return null;
      const experimentId = identifier(item.experimentId), variant = identifier(item.variant);
      if (!experimentId || !variant || !configuredExperiments().get(experimentId)?.has(variant) || experiments.some((entry) => entry.experimentId === experimentId)) return null;
      experiments.push({ experimentId, variant });
    }
    let acquisition: AcquisitionAttribution | undefined;
    if (root.acquisition !== undefined) {
      const input = record(root.acquisition);
      if (!input || !exactKeys(input, ["source", "medium", "campaign", "landingPath"])) return null;
      const source = identifier(input.source);
      const medium = input.medium === undefined ? null : identifier(input.medium);
      const campaign = input.campaign === undefined ? null : identifier(input.campaign);
      if (!source || !SOURCES.has(source) || (input.medium !== undefined && (!medium || !MEDIUMS.has(medium)))
        || (input.campaign !== undefined && (!campaign || !configuredCampaigns().has(campaign)))
        || typeof input.landingPath !== "string" || !publicMeasurementPath(input.landingPath)) return null;
      acquisition = { source, ...(medium ? { medium } : {}), ...(campaign ? { campaign } : {}), landingPath: input.landingPath };
    }
    if (!acquisition && experiments.length === 0) return null;
    return { ...(acquisition ? { acquisition } : {}), experiments };
  } catch { return null; }
}

function cookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  try {
    for (const entry of document.cookie.split(";")) {
      const separator = entry.indexOf("=");
      if (separator >= 0 && entry.slice(0, separator).trim() === name) return entry.slice(separator + 1).trim();
    }
  } catch { /* Measurement stays disabled when cookies are inaccessible. */ }
  return null;
}
function writeCookie(name: string, value: string, maxAge = MAX_AGE_SECONDS) {
  if (typeof document === "undefined") return;
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  try { document.cookie = `${name}=${value}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`; } catch { /* no-op */ }
}
export function analyticsConsent(): AnalyticsConsent | null {
  const value = cookie(ANALYTICS_CONSENT_COOKIE); return value === "granted" || value === "denied" ? value : null;
}
export function setAnalyticsConsent(value: AnalyticsConsent) {
  writeCookie(ANALYTICS_CONSENT_COOKIE, value, 180 * 24 * 60 * 60); if (value === "denied") clearMeasurement();
  if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent<AnalyticsConsent>(ANALYTICS_CONSENT_EVENT,{detail:value}));
}
export function clearMeasurement() { writeCookie(MEASUREMENT_COOKIE, "", 0); }
export function getOrderAttribution(): OrderAttribution | null { return parseOrderAttribution(cookie(MEASUREMENT_COOKIE), analyticsConsent()); }
export function writeOrderAttribution(value: OrderAttribution): OrderAttribution | null {
  if (analyticsConsent() !== "granted") return null;
  const encoded = encodeURIComponent(JSON.stringify(value)); const checked = parseOrderAttribution(encoded);
  if (!checked) return null; writeCookie(MEASUREMENT_COOKIE, encodeURIComponent(JSON.stringify(checked))); return checked;
}

/** Records a first public landing only. Raw referrer and non-allowlisted query
 * fields are never read. Existing acquisition wins across later visits. */
export function captureAcquisition(href: string): OrderAttribution | null {
  if (analyticsConsent() !== "granted") return null;
  const existing = getOrderAttribution(); if (existing?.acquisition) return existing;
  try {
    const url = new URL(href); if (!publicMeasurementPath(url.pathname)) return existing;
    const source = identifier(url.searchParams.get("utm_source"));
    const medium = identifier(url.searchParams.get("utm_medium")); const campaign = identifier(url.searchParams.get("utm_campaign"));
    if(!source||!SOURCES.has(source)||(url.searchParams.has("utm_medium")&&(!medium||!MEDIUMS.has(medium)))
      ||(url.searchParams.has("utm_campaign")&&(!campaign||!configuredCampaigns().has(campaign))))return existing;
    return writeOrderAttribution({acquisition:{source,...(medium?{medium}:{}),...(campaign?{campaign}:{}),landingPath:url.pathname},experiments:existing?.experiments??[]});
  } catch { return existing; }
}
export function storeExperimentAssignment(assignment: ExperimentAssignment): ExperimentAssignment | null {
  if (analyticsConsent() !== "granted") return null;
  const experimentId=identifier(assignment.experimentId),variant=identifier(assignment.variant);if(!experimentId||!variant||!configuredExperiments().get(experimentId)?.has(variant))return null;
  const existing=getOrderAttribution(),earlier=existing?.experiments.find((entry)=>entry.experimentId===experimentId);if(earlier)return earlier;
  const experiments=[...(existing?.experiments??[]),{experimentId,variant}];if(experiments.length>8)return null;
  const written=writeOrderAttribution({...(existing?.acquisition?{acquisition:existing.acquisition}:{}),experiments});
  return written?.experiments.find((entry)=>entry.experimentId===experimentId)??null;
}
