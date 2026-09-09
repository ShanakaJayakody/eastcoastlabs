import {beforeEach,it,expect,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import {recoveryToken,recoveryTokenHash,recoveryLink} from '@/lib/recovery-token';
beforeEach(()=>vi.stubEnv('ORDER_ACCESS_SECRET','synthetic-secret-at-least-32-characters'));
it('derives an opaque stable purpose-separated token, and only hash is used for lookup',()=>{
 const id='00000000-0000-0000-0000-000000000001';const token=recoveryToken(id);
 expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);expect(token).not.toContain(id);expect(recoveryToken(id)).toBe(token);
 expect(recoveryTokenHash(token)).toMatch(/^[a-f0-9]{64}$/);expect(recoveryTokenHash('bad')).toBeNull();
 expect(recoveryLink(id)).toBe(`https://www.eastcoastlabs.com.au/cart-recovery?token=${token}`);
 expect(()=>recoveryLink('https://evil.test')).toThrow();
});
