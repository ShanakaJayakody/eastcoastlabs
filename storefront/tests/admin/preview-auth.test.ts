import {afterEach,expect,it,vi} from 'vitest';
import {adminAuthOrigin} from '@/lib/admin/preview-origin';
afterEach(()=>vi.unstubAllEnvs());
it('uses only a configured Vercel preview origin',()=>{
  vi.stubEnv('VERCEL_ENV','preview');vi.stubEnv('VERCEL_URL','ecl-reviewed-preview.vercel.app');
  expect(adminAuthOrigin()).toBe('https://ecl-reviewed-preview.vercel.app');
});
it.each(['','evil.test','https://example.vercel.app','example.vercel.app/path','user@example.vercel.app'])('rejects missing or malformed preview origin %s',(value)=>{
  vi.stubEnv('VERCEL_ENV','preview');vi.stubEnv('VERCEL_URL',value);
  expect(()=>adminAuthOrigin()).toThrow(/origin/i);
});
it('keeps the production callback',()=>{
  vi.stubEnv('VERCEL_ENV','production');vi.stubEnv('NEXT_PUBLIC_SITE_URL','https://www.eastcoastlabs.com.au');
  expect(adminAuthOrigin()).toBe('https://www.eastcoastlabs.com.au');
});
