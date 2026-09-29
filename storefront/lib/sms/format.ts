import type { AdminSmsSummary } from './types';

const WATCHED = [
  ['bacteriostatic-water','Bac Water'], ['alcohol-swabs','Alc Swabs'],
  ['semaglutide','Sema'], ['tesamorelin','Tesa'], ['ss-31','SS31'], ['igf','IGF'],
] as const;
export const ADMIN_SMS_STOCK_SLUGS=WATCHED.map(([slug])=>slug);
const GSM = new Set(Array.from('@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà'));
const EXTENDED = new Set(Array.from('\f^{}\\[~]|€'));
export function smsSegments(body: string): number {
  let count=0;
  for (const character of body) {
    if (GSM.has(character)) count++; else if (EXTENDED.has(character)) count+=2;
    else throw new Error('SMS contains an unsupported character');
  }
  if (!count || count>306) throw new Error('SMS exceeds the two-part limit or is empty');
  return count<=160?1:Math.ceil(count/153);
}
export function normalizeAustralianMobile(input: string): string|null {
  const compact=input.trim().replace(/[\s()-]/g,'').replace(/^\+/,'');
  const number=compact.startsWith('04')?'61'+compact.slice(1):compact;
  return /^614\d{8}$/.test(number)?number:null;
}
export function renderAdminSms(summary: AdminSmsSummary): string {
  for(const value of [summary.yesterdayRevenueCents,summary.monthRevenueCents,summary.overdueFulfilment])
    if(!Number.isSafeInteger(value)||value<0) throw new Error('SMS totals unavailable or invalid');
  if(!Array.isArray(summary.lowStockNames)||summary.lowStockNames.some(name=>!WATCHED.some(([,alias])=>alias===name)))
    throw new Error('SMS stock summary is invalid');
  const money=(cents:number)=>new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(cents/100);
  const body=[
    'Daily ECL Director Update:',
    `Yesterday's Revenue: ${money(summary.yesterdayRevenueCents)}`,
    `Overdue Orders to fulfil: ${summary.overdueFulfilment}`,
    `Monthly Revenue: ${money(summary.monthRevenueCents)}`,
    `Low Stock: ${summary.lowStockNames.length?summary.lowStockNames.join(', '):'None'}`,
  ].join('\n');
  smsSegments(body);
  return body;
}
export function selectLowStockNames(products: Array<{slug:string;variants:Array<{available:number;low_stock_threshold:number}>}>):string[] {
  return WATCHED.filter(([slug,alias])=>{
    const family=products.filter(p=>p.slug===slug||p.slug.startsWith(slug+'-size-'));
    if(!family.length||family.some(p=>!p.variants.length)) throw new Error(`Stock unavailable for ${alias}`);
    const variants=family.flatMap(p=>p.variants);
    if(variants.some(v=>!Number.isFinite(v.available)||!Number.isFinite(v.low_stock_threshold))) throw new Error(`Stock unavailable for ${alias}`);
    return variants.some(v=>v.available<=v.low_stock_threshold);
  }).map(([,alias])=>alias);
}
function localParts(now:Date) {
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Melbourne',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));
  return {day:`${p.year}-${p.month}-${p.day}`,hour:Number(p.hour)};
}
export function smsSchedule(now:Date,startHour:number) {
  if(!Number.isInteger(startHour)||startHour<0||startHour>19) throw new Error('Invalid SMS delivery hour');
  const {day,hour}=localParts(now);
  const endHour=startHour+4;
  const civil=new Date(`${day}T${String(endHour).padStart(2,'0')}:00:00Z`).getTime();
  const end=[10,11].map(offset=>new Date(civil-offset*3600000)).find(d=>{
    const p=localParts(d);return p.day===day&&p.hour===endHour;
  });
  if(!end) throw new Error('SMS delivery window unavailable');
  return {day,eligible:hour>=startHour&&hour<endHour,expiresAt:end.toISOString()};
}
