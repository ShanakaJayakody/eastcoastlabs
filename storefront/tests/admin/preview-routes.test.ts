import {afterEach,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
vi.mock('@supabase/ssr',()=>({createServerClient:vi.fn(()=>{throw Error('Unexpected auth network');})}));
import {middleware} from '@/middleware';
afterEach(()=>vi.unstubAllEnvs());
it.each(['/api/cron/email-outbox','/api/cron/daily-brief','/api/unsubscribe','/subscribe/confirm','/cart-recovery/confirm','/checkout','/api/webhooks/resend'])('blocks preview route %s even for GET',async path=>{
  vi.stubEnv('VERCEL_ENV','preview');
  const result=await middleware(new NextRequest('https://preview.test'+path));
  expect(result.status).toBe(403);
  expect(result.headers.get('Cache-Control')).toContain('no-store');
});
it('redirects the preview root to admin while leaving the production storefront alone',async()=>{
  vi.stubEnv('VERCEL_ENV','preview');
  expect((await middleware(new NextRequest('https://preview.test/'))).headers.get('location')).toBe('https://preview.test/admin');
  vi.stubEnv('VERCEL_ENV','production');vi.stubEnv('ADMIN_PREVIEW_READ_ONLY','');
  expect((await middleware(new NextRequest('https://preview.test/'))).status).toBe(200);
});
