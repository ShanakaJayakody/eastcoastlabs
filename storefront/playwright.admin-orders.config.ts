import {defineConfig} from '@playwright/test';
const baseURL=process.env.ECL_ADMIN_ORDERS_BASE_URL;
const storageState=process.env.ECL_ADMIN_ORDERS_STORAGE_STATE;
if(!baseURL||!storageState)throw new Error('Real orders tests require ECL_ADMIN_ORDERS_BASE_URL and ECL_ADMIN_ORDERS_STORAGE_STATE for a disposable test environment.');
const target=new URL(baseURL);
if(!['localhost','127.0.0.1','[::1]'].includes(target.hostname)&&!/^ecl-admin-orders-test(?:-[a-z0-9-]+)?\.vercel\.app$/.test(target.hostname))throw new Error('Refusing production or unrecognized host. Use loopback or an ecl-admin-orders-test Vercel preview.');
if(target.username||target.password)throw new Error('Do not put credentials in the test URL.');
export default defineConfig({testDir:'./tests/browser',testMatch:'orders-workspace-next.spec.ts',workers:1,retries:0,use:{baseURL,storageState,viewport:{width:1280,height:900},trace:'retain-on-failure'},reporter:'list'});
