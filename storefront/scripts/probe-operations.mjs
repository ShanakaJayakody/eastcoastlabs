import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

const origin = 'https://www.eastcoastlabs.com.au';
const labels = { public: 'Public availability', operations: 'Operations health' };

/**
 * Read-only probes. Only fixed diagnostics leave this function; response bodies,
 * exception messages and the bearer secret are never written to logs.
 * @param {{secret?: string, fetchImpl?: (url: string, options: RequestInit) => Promise<Response>, wait?: (ms: number) => Promise<unknown>, log?: (line: string) => void}} options
 */
export async function runMonitoring({ secret = process.env.CRON_SECRET, fetchImpl = fetch, wait = delay, log = console.log } = {}) {
  async function probe(kind) {
    if (kind === 'operations' && !secret?.trim()) {
      return { ok: false, attempts: 0, status: null, reason: 'CRON_SECRET is not configured' };
    }
    let status = null;
    try {
      const response = await fetchImpl(`${origin}${kind === 'public' ? '/' : '/api/operations/health'}`, {
        method: 'GET',
        headers: kind === 'operations' ? { Authorization: `Bearer ${secret}` } : {},
        // Never forward the bearer secret to a redirect destination.
        redirect: 'manual',
        cache: 'no-store',
        signal: AbortSignal.timeout(15_000),
      });
      status = response.status;
      if (status !== 200) {
        await response.body?.cancel();
        return { ok: false, attempts: 1, status, reason: `HTTP ${status}` };
      }
      if (kind === 'public') {
        await response.body?.cancel();
        return { ok: true, attempts: 1, status, reason: 'HTTP 200' };
      }
      const health = await response.json();
      const ok = health?.ok === true
        && Array.isArray(health.jobs) && health.jobs.length > 0
        && health.jobs.every(job => job?.state === 'ok')
        && health.delivery?.dead === 0 && health.delivery?.overdue === 0;
      return { ok, attempts: 1, status, reason: ok ? 'Jobs and delivery queue healthy' : 'Unhealthy jobs, delivery queue or invalid health data' };
    } catch {
      return { ok: false, attempts: 1, status, reason: 'Request timed out, failed or returned invalid health data' };
    }
  }

  const kinds = ['public', 'operations'];
  let results = await Promise.all(kinds.map(probe));
  if (results.some(result => !result.ok && result.attempts > 0)) {
    log('A probe failed; rechecking failed probes once after 30 seconds.');
    await wait(30_000);
    results = await Promise.all(results.map(async (result, index) =>
      !result.ok && result.attempts > 0 ? { ...await probe(kinds[index]), attempts: 2 } : result));
  }
  results.forEach((result, index) => {
    log(`${labels[kinds[index]]}: ${result.ok ? 'PASS' : 'FAIL'} — ${result.reason} (${result.attempts} attempt${result.attempts === 1 ? '' : 's'}).`);
  });
  return { ok: results.every(result => result.ok), public: results[0], operations: results[1] };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await runMonitoring();
    process.exitCode = result.ok ? 0 : 1;
  } catch {
    console.error('Monitoring failed before completion; no health result is available.');
    process.exitCode = 1;
  }
}
