import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {gzipSync} from 'node:zlib';
/** @param {{pages:Record<string,string[]>}} manifest @param {string} route */
export function routeFiles(manifest,route) {
 if(!manifest.pages[route])throw new Error(`Required route missing from build: ${route}`);
 const segments=route.split('/').slice(1,-1);
 const layouts=['/layout',...segments.map((_,index)=>`/${segments.slice(0,index+1).join('/')}/layout`)];
 return [...new Set([...layouts.flatMap(layout=>manifest.pages[layout]??[]),...manifest.pages[route]].filter(file=>file.endsWith('.js')))];
}
/** @param {number} bytes @param {number} maxGzipKB */
export function evaluateBudget(bytes,maxGzipKB){return bytes<=maxGzipKB*1000;}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const directory=resolve(process.env.NEXT_DIST_DIR||'.next');
 const manifest=JSON.parse(readFileSync(resolve(directory,'app-build-manifest.json'),'utf8'));
 const config=JSON.parse(readFileSync('config/performance-budgets.json','utf8'));
 let failed=false;
 for(const [route,maxGzipKB] of Object.entries(config.routeGzipKB)){
  const files=routeFiles(manifest,route);
  const bytes=files.reduce((sum,file)=>sum+gzipSync(readFileSync(resolve(directory,file))).length,0);
  const ok=evaluateBudget(bytes,Number(maxGzipKB));
  console.log(`${ok?'PASS':'FAIL'} ${route}: ${(bytes/1000).toFixed(1)} kB gzip; limit ${maxGzipKB} kB (${files.length} unique JS files)`);
  if(!ok)failed=true;
 }
 if(failed)process.exitCode=1;
}
