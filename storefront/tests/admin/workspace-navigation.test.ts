import {expect,it} from 'vitest';
import {NAV,WORKSPACES,workspaceForPath} from '@/lib/admin/nav';
it('retains every existing destination across seven workspaces',()=>{
 expect(WORKSPACES).toHaveLength(7);
 expect(WORKSPACES.flatMap(w=>w.routes).sort()).toEqual(NAV.map(n=>n.href).sort());
});
it.each([['/admin','today'],['/admin/orders/123','orders'],['/admin/orders/fulfilment','orders'],['/admin/products/size/edit','catalogue'],['/admin/creators/123','marketing'],['/admin/audit','settings']])('selects %s', (path,id)=>expect(workspaceForPath(path).id).toBe(id));
