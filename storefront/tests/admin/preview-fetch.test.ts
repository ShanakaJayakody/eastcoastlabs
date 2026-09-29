import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {createPreviewDataFetch} from '@/lib/admin/preview-fetch';
beforeEach(()=>vi.stubEnv('VERCEL_ENV','preview'));
afterEach(()=>vi.unstubAllEnvs());
it.each([
  ['/rest/v1/orders','POST'],['/rest/v1/orders','PATCH'],['/rest/v1/orders','DELETE'],
  ['/storage/v1/object/assets/image','POST'],['/auth/v1/admin/users','POST'],
  ['/rest/v1/rpc/admin_delete_order','GET'],['/rest/v1/rpc/admin_delete_order','POST'],
  ['/rest/v1/rpc/admin_preview_carrier','POST'],['/rest/v1/rpc/unknown','HEAD'],
  ['/rest/v1/rpc/%61dmin_order_status_counts','POST'],['/rest/v1/rpc/admin_order_status_counts/','POST'],
])('rejects %s %s before network access',async(path,method)=>{
  const send=vi.fn();const guarded=createPreviewDataFetch('https://store.test',send);
  await expect(guarded('https://store.test'+path,{method})).rejects.toThrow(/read.only/i);
  expect(send).not.toHaveBeenCalled();
});
it('preserves allowed data reads and audited report POSTs without following redirects',async()=>{
  const send=vi.fn(async()=>new Response('[]'));const guarded=createPreviewDataFetch('https://store.test',send);
  await guarded('https://store.test/rest/v1/orders?select=id');
  await guarded('https://store.test/rest/v1/rpc/admin_order_status_counts',{method:'POST',body:'{}'});
  expect(send).toHaveBeenCalledTimes(2);
  expect(send.mock.calls[1]).toEqual(['https://store.test/rest/v1/rpc/admin_order_status_counts',{method:'POST',body:'{}',redirect:'error'}]);
});
it('rejects a foreign origin and honors Request method overrides',async()=>{
  const send=vi.fn();const guarded=createPreviewDataFetch('https://store.test',send);
  await expect(guarded('https://other.test/rest/v1/orders')).rejects.toThrow(/read.only/i);
  await expect(guarded(new Request('https://store.test/rest/v1/orders'),{method:'DELETE'})).rejects.toThrow(/read.only/i);
  expect(send).not.toHaveBeenCalled();
});
it('leaves the production transport unchanged',async()=>{
  vi.stubEnv('VERCEL_ENV','production');vi.stubEnv('ADMIN_PREVIEW_READ_ONLY','');
  const send=vi.fn(async()=>new Response('{}'));
  await createPreviewDataFetch('https://store.test',send)('https://store.test/rest/v1/orders',{method:'PATCH'});
  expect(send.mock.calls[0]).toEqual(['https://store.test/rest/v1/orders',{method:'PATCH'}]);
});
