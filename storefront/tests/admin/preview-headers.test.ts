import {expect,it} from 'vitest';
import config from '../../next.config';
it('makes every admin route private and non-indexable',async()=>{
  const entries=await config.headers!();
  const headers=entries.find(entry=>entry.source==='/admin/:path*')?.headers;
  expect(headers).toEqual(expect.arrayContaining([
    {key:'Cache-Control',value:'private, no-store, max-age=0'},
    {key:'Referrer-Policy',value:'no-referrer'},
    {key:'X-Robots-Tag',value:'noindex, nofollow, noarchive'},
  ]));
});
