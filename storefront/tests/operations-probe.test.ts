import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { afterEach, expect, it } from 'vitest';
import { runMonitoring } from '../scripts/probe-operations.mjs';

const secret = 'synthetic-monitor-secret';
// Capture native fetch before the suite's network-denial hook; only loopback is used below.
const localFetch = globalThis.fetch;
const healthy = {
  ok: true,
  checkedAt: '2026-09-09T00:00:00.000Z',
  jobs: [{ job: 'email-outbox', state: 'ok', ageHours: 1 }],
  delivery: { dead: 0, overdue: 0 },
};
const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => { await Promise.all(cleanups.splice(0).map(close => close())); });

async function localSite(handler: (req: IncomingMessage, res: ServerResponse) => void) {
  const requests: Array<{ url: string; options: RequestInit | undefined }> = [];
  const server = createServer(handler);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  cleanups.push(() => new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  const port = (server.address() as { port: number }).port;
  // Only the transport destination changes; request policy and real fetch remain intact.
  const fetchImpl = (url: string, options?: RequestInit) => {
    requests.push({ url, options });
    return localFetch(`http://127.0.0.1:${port}${new URL(url).pathname}`, options);
  };
  return { fetchImpl, requests };
}
function reply(res: ServerResponse, status = 200, body: unknown = healthy) {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'private, no-store' });
  res.end(JSON.stringify(body));
}
function monitorOptions(fetchImpl: (url: string, options?: RequestInit) => Promise<Response>) {
  const delays: number[] = [];
  const logs: string[] = [];
  return { secret, fetchImpl, wait: async (ms: number) => { delays.push(ms); }, log: (line: string) => { logs.push(line); }, delays, logs };
}

it('checks canonical public availability without credentials and authenticates only the read-only health path', async () => {
  const seen: Array<{ path: string; auth?: string; method?: string; body: string }> = [];
  const site = await localSite((req, res) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => { seen.push({ path: req.url!, auth: req.headers.authorization, method: req.method, body }); reply(res); });
  });
  const options = monitorOptions(site.fetchImpl);
  expect(await runMonitoring(options)).toMatchObject({ ok: true, public: { ok: true, attempts: 1 }, operations: { ok: true, attempts: 1 } });
  expect(site.requests.map(request => request.url).sort()).toEqual([
    'https://www.eastcoastlabs.com.au/', 'https://www.eastcoastlabs.com.au/api/operations/health',
  ]);
  expect(seen).toEqual(expect.arrayContaining([
    { path: '/', auth: undefined, method: 'GET', body: '' },
    { path: '/api/operations/health', auth: `Bearer ${secret}`, method: 'GET', body: '' },
  ]));
  expect(options.delays).toEqual([]);
  expect(options.logs.join('\n')).not.toContain(secret);
});

it('rechecks a transient public failure once after 30 seconds and reports recovery', async () => {
  let publicCalls = 0;
  const site = await localSite((req, res) => reply(res, req.url === '/' && ++publicCalls === 1 ? 503 : 200));
  const options = monitorOptions(site.fetchImpl);
  expect(await runMonitoring(options)).toMatchObject({ ok: true, public: { ok: true, attempts: 2 }, operations: { ok: true, attempts: 1 } });
  expect(options.delays).toEqual([30_000]);
  expect(site.requests).toHaveLength(3);
});

it('reports an unavailable public site independently from healthy internal operations', async () => {
  const site = await localSite((req, res) => reply(res, req.url === '/' ? 503 : 200));
  const options = monitorOptions(site.fetchImpl);
  expect(await runMonitoring(options)).toMatchObject({ ok: false, public: { ok: false, attempts: 2 }, operations: { ok: true, attempts: 1 } });
  expect(options.delays).toEqual([30_000]);
  expect(options.logs.join('\n')).toMatch(/Public availability.*FAIL/);
  expect(options.logs.join('\n')).toMatch(/Operations health.*PASS/);
});

it.each([
  { name: 'unhealthy jobs', body: { ...healthy, jobs: [{ job: 'email-outbox', state: 'overdue', ageHours: 4 }] } },
  { name: 'dead deliveries', body: { ...healthy, delivery: { dead: 1, overdue: 0 } } },
  { name: 'overdue deliveries', body: { ...healthy, delivery: { dead: 0, overdue: 1 } } },
  { name: 'missing health fields', body: { ok: true } },
  { name: 'negative health signal', body: { ...healthy, ok: false } },
])('fails operations for $name even with HTTP 200 while preserving public availability', async ({ body }) => {
  const site = await localSite((req, res) => reply(res, 200, req.url === '/' ? healthy : body));
  const options = monitorOptions(site.fetchImpl);
  expect(await runMonitoring(options)).toMatchObject({ ok: false, public: { ok: true, attempts: 1 }, operations: { ok: false, attempts: 2 } });
  expect(options.delays).toEqual([30_000]);
  expect(options.logs.join('\n')).toMatch(/Public availability.*PASS/);
  expect(options.logs.join('\n')).toMatch(/Operations health.*FAIL/);
});

it('never follows an authenticated redirect or logs response content', async () => {
  let redirectVisits = 0;
  const privateContent = `recipient@example.test ${secret}`;
  const site = await localSite((req, res) => {
    if (req.url === '/api/operations/health') {
      res.writeHead(302, { location: '/redirect-target' });
      res.end(privateContent);
    } else { if (req.url === '/redirect-target') redirectVisits++; reply(res); }
  });
  const options = monitorOptions(site.fetchImpl);
  expect(await runMonitoring(options)).toMatchObject({ ok: false, operations: { ok: false, attempts: 2, status: 302 } });
  expect(redirectVisits).toBe(0);
  expect(options.logs.join('\n')).not.toContain(privateContent);
  expect(options.logs.join('\n')).not.toContain(secret);
});

it('fails malformed operations JSON without logging its content', async () => {
  const site = await localSite((req, res) => {
    if (req.url === '/') reply(res);
    else res.end(`recipient@example.test ${secret}`);
  });
  const options = monitorOptions(site.fetchImpl);
  expect(await runMonitoring(options)).toMatchObject({ ok: false, operations: { ok: false, attempts: 2 } });
  expect(options.logs.join('\n')).not.toMatch(/recipient@example.test|synthetic-monitor-secret/);
});

it('checks public availability but fails closed without a configured operations secret', async () => {
  const site = await localSite((_req, res) => reply(res));
  const options = { ...monitorOptions(site.fetchImpl), secret: '' };
  expect(await runMonitoring(options)).toMatchObject({ ok: false, public: { ok: true }, operations: { ok: false, attempts: 0 } });
  expect(site.requests.map(request => new URL(request.url).pathname)).toEqual(['/']);
  expect(options.delays).toEqual([]);
  expect(options.logs.join('\n')).toMatch(/CRON_SECRET/);
});

it('aborts an operations response stalled beyond 15 seconds and rechecks once', async () => {
  let calls = 0;
  const site = await localSite((req, res) => {
    if (req.url !== '/api/operations/health' || ++calls > 1) reply(res);
    else { res.writeHead(200, { 'content-type': 'application/json' }); res.write('{'); }
  });
  const options = monitorOptions(site.fetchImpl);
  const started = Date.now();
  expect(await runMonitoring(options)).toMatchObject({ ok: true, operations: { ok: true, attempts: 2 } });
  expect(Date.now() - started).toBeGreaterThanOrEqual(14_900);
  expect(Date.now() - started).toBeLessThan(20_000);
  expect(options.delays).toEqual([30_000]);
}, 25_000);
