import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
import base from './vite.config.mts';
const mock=fileURLToPath(new URL('./admin-integrated-data.ts',import.meta.url));
export default defineConfig({...base,resolve:{alias:[
 ...['@/lib/admin/auth-actions','@/app/admin/search-actions','@/app/admin/(dashboard)/overview-actions','@/app/admin/(dashboard)/orders/actions','@/app/admin/(dashboard)/orders/preview-actions'].map(find=>({find,replacement:mock})),
 ...(Array.isArray(base.resolve?.alias)?base.resolve.alias:[]),
]},server:{...base.server,port:4187,strictPort:true}});
