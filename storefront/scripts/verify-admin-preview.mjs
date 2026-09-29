// Non-mutating checks only. Never log response bodies, credentials or records.
const target=new URL(process.argv[2]);
if(target.protocol!=='https:'||!target.hostname.endsWith('.vercel.app'))throw Error('Use the HTTPS Vercel preview URL.');
let protectedByVercel=false;
for(const path of ['/admin','/admin/login','/api/cron/email','/api/cron/paid-analytics','/checkout','/api/unsubscribe']){
 const result=await fetch(new URL(path,target),{redirect:'manual'});
 const location=result.headers.get('location');
 const deploymentProtection=result.status===401||((result.status===302||result.status===307)&&location?.includes('vercel.com'));
 console.log(JSON.stringify({path,status:result.status,cache:result.headers.get('cache-control'),robots:result.headers.get('x-robots-tag'),deploymentProtection:Boolean(deploymentProtection)}));
 if(deploymentProtection){protectedByVercel=true;continue;}
 if(!result.headers.get('cache-control')?.includes('no-store'))throw Error(path+': missing private no-store protection');
 if(path==='/admin'){
  if(![302,303,307,308].includes(result.status)||new URL(location??'/',target).pathname!=='/admin/login')throw Error('Anonymous admin did not redirect to login');
 }else if(path==='/admin/login'){
  if(result.status!==200)throw Error('Admin login unavailable');
 }else if(result.status!==403)throw Error(path+': non-admin route was not denied');
}
console.log(protectedByVercel?'Deployment protection verified; application-level hosted checks require owner sign-in.':'Application auth redirects, private headers and non-admin denial verified.');
