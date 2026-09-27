import type {Metric,Period,Statistic,Stats} from './types';
export const TIMEZONE='Australia/Sydney';
export function duration(seconds:number|null|undefined):string {
 if(seconds==null||!Number.isFinite(seconds)||seconds<0)return '—';
 const s=Math.floor(seconds);if(s<60)return `${s}s`;
 const minutes=Math.floor(s/60),days=Math.floor(minutes/1440),hours=Math.floor(minutes%1440/60),mins=minutes%60;
 return [days?`${days}d`:'',hours?`${hours}h`:'',mins?`${mins}m`:''].filter(Boolean).join(' ');
}
export const days=(seconds:number|null)=>seconds==null?'—':(seconds/86400).toFixed(2);
export const localDate=(value:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:TIMEZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
export const timestamp=(value:string|null)=>value?new Intl.DateTimeFormat('en-AU',{timeZone:TIMEZONE,day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit',second:'2-digit',timeZoneName:'short'}).format(new Date(value)):'Not recorded';
export function periodLabel(key:string,grain:'week'|'month') {
 return new Intl.DateTimeFormat('en-AU',{timeZone:'UTC',month:'short',year:'numeric',...(grain==='week'?{day:'numeric' as const}:{})}).format(new Date(key+'T00:00:00Z'));
}
export function compareStats(previous:Stats,current:Stats,stat:Statistic){
 const a=previous[stat],b=current[stat];if(a==null||b==null)return null;
 return {delta:b-a,percent:a===0?null:(b-a)/a*100,currentCount:current.n,previousCount:previous.n,smallSample:Math.min(current.n,previous.n)<10};
}
export function completeComparison(periods:Period[],metric:Metric,stat:Statistic){
 // Choose the most recent complete period, then its immediate predecessor;
 // never skip an empty or partial predecessor to manufacture an improvement.
 const last=periods.findLastIndex(p=>p.partial.length===0);
 if(last<1||periods[last-1].partial.length)return null;
 const result=compareStats(periods[last-1][metric],periods[last][metric],stat);
 return result?{...result,currentKey:periods[last].key,previousKey:periods[last-1].key}:null;
}
