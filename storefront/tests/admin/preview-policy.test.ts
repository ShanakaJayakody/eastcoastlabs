import {afterEach,expect,it,vi} from 'vitest';
import {isReadOnlyPreview,assertPreviewWritable} from '@/lib/admin/preview-policy';
afterEach(()=>vi.unstubAllEnvs());
it('cannot enable writes on a Vercel preview by clearing a flag',()=>{
  vi.stubEnv('VERCEL_ENV','preview');vi.stubEnv('ADMIN_PREVIEW_READ_ONLY','0');
  expect(isReadOnlyPreview()).toBe(true);
  expect(()=>assertPreviewWritable()).toThrow(/read.only/i);
});
it('allows ordinary production but can explicitly protect a local review',()=>{
  vi.stubEnv('VERCEL_ENV','production');vi.stubEnv('ADMIN_PREVIEW_READ_ONLY','');
  expect(()=>assertPreviewWritable()).not.toThrow();
  vi.stubEnv('ADMIN_PREVIEW_READ_ONLY','1');
  expect(()=>assertPreviewWritable()).toThrow(/read.only/i);
});
