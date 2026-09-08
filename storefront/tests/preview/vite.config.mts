import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const local = (file:string) => fileURLToPath(new URL(file, import.meta.url));
export default defineConfig({
 root: local('.'),
 publicDir: `${root}public`,
 define: {"process.env": "{}"},
 resolve: {alias:[
  {find:'@/app/cart-recovery/actions',replacement:local('./recovery-actions.ts')},
  {find:'@/app/(store)/checkout/actions',replacement:local('./actions.ts')},
  {find:'@/lib/env',replacement:local('./env.ts')},
  {find:'next/navigation',replacement:local('./navigation.ts')},
  {find:'next/link',replacement:local('./link.tsx')},
  {find:'next/image',replacement:local('./image.tsx')},
  {find:'@',replacement:root},
 ]},
 oxc:{jsx:{runtime:'automatic'}},
 server:{host:'127.0.0.1',port:4174,strictPort:true,fs:{allow:[root]}},
});
