import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/browser',
 fullyParallel:true,
 forbidOnly:!!process.env.CI,
 retries:process.env.CI?1:0,
 workers:process.env.CI?2:undefined,
 reporter:[['list'],['html',{open:'never'}]],
 use:{baseURL:'http://127.0.0.1:4174',trace:'retain-on-failure',screenshot:'only-on-failure'},
 projects:[
  {name:'mobile-320',use:{...devices['Desktop Chrome'],viewport:{width:320,height:844}}},
  {name:'mobile-390',use:{...devices['Desktop Chrome'],viewport:{width:390,height:844}}},
  {name:'desktop',use:{...devices['Desktop Chrome'],viewport:{width:1280,height:900}}},
 ],
 webServer:{command:'npm run preview:audit',url:'http://127.0.0.1:4174/frame.html',reuseExistingServer:!process.env.CI,timeout:30000},
});
