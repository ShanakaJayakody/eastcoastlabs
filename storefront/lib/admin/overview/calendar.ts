import type {OverviewRange,OverviewWindow,Interval} from './types';
const zone='Australia/Melbourne';
const clock=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
export function localParts(now:Date){
 if(!Number.isFinite(now.getTime()))throw new Error('Invalid report time');
 return Object.fromEntries(clock.formatToParts(now).map(p=>[p.type,p.value]));
}
export function localDay(now:Date){const p=localParts(now);return `${p.year}-${p.month}-${p.day}`;}
export function shiftDay(day:string,n:number){return new Date(Date.parse(day+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);}
function validDay(day:unknown):day is string{return typeof day==='string'&&/^20\d{2}-\d{2}-\d{2}$/.test(day)&&Number.isFinite(Date.parse(day))&&new Date(day+'T00:00:00Z').toISOString().slice(0,10)===day;}
function wallNumber(now:Date){const p=localParts(now);return Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}.000Z`);}
/** Resolve a Melbourne civil time, taking the earlier repeated time. Gaps clamp
 * forward to the first valid mapped wall time; midnight is never ambiguous here. */
export function localInstant(day:string,time='00:00:00',ms=0):Date {
 const target=Date.parse(day+'T'+time+'.000Z');
 const offsets=new Set([-86400000,0,86400000].map(delta=>wallNumber(new Date(target+delta))-(target+delta)));
 const candidates=[...offsets].map(offset=>new Date(target-offset));
 const exact=candidates.filter(date=>wallNumber(date)===target).sort((a,b)=>+a-+b);
 const selected=exact[0]??candidates.filter(date=>wallNumber(date)>target).sort((a,b)=>wallNumber(a)-wallNumber(b))[0];
 if(!selected)throw new Error('Invalid local date');
 return new Date(+selected+ms);
}
function buckets(from:Date,until:Date,hourly:boolean):Interval[]{
 const result:Interval[]=[];
 for(let cursor=from;+cursor<+until;){
  const next=hourly?new Date(+cursor+3600000):localInstant(shiftDay(localDay(cursor),1));
  const end=new Date(Math.min(+next,+until));
  result.push({from:cursor.toISOString(),until:end.toISOString()});cursor=end;
 }
 return result;
}
const dayLabel=new Intl.DateTimeFormat('en-AU',{timeZone:zone,day:'numeric',month:'short',year:'numeric'});
const hourLabel=new Intl.DateTimeFormat('en-AU',{timeZone:zone,day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZoneName:'shortOffset'});
export function overviewWindow(range:OverviewRange,now:Date):OverviewWindow {
 if(!range||typeof range!=='object'||!['today','week','month','custom'].includes(range.kind))throw new Error('Choose a valid revenue period.');
 const p=localParts(now),day=localDay(now),time=`${p.hour}:${p.minute}:${p.second}`,midnight=localInstant(day);
 let from:Date,until:Date,previousFrom:Date,previousUntil:Date;
 let timing='Completed days · Melbourne time',label:string;
 if(range.kind==='today'){
  from=midnight;until=now;previousFrom=localInstant(shiftDay(day,-1));previousUntil=localInstant(shiftDay(day,-1),time,now.getUTCMilliseconds());
  timing='Today and yesterday to the same local time · Melbourne time';label='Today';
 }else if(range.kind==='week'){
  from=localInstant(shiftDay(day,-7));until=midnight;previousFrom=localInstant(shiftDay(day,-14));previousUntil=from;label='Last 7 completed days';
 }else if(range.kind==='month'){
  const first=day.slice(0,7)+'-01',priorLast=shiftDay(first,-1),priorFirst=priorLast.slice(0,7)+'-01';
  from=localInstant(first);until=now;previousFrom=localInstant(priorFirst);
  const clamped=Number(p.day)>Number(priorLast.slice(-2));
  previousUntil=clamped?from:localInstant(priorFirst.slice(0,8)+p.day,time,now.getUTCMilliseconds());
  timing=clamped?'Prior month is shorter; comparison ends at its last midnight. Missing days are gaps.':'Month to date vs the same local day and time last month';
  label='Month to date';
 }else{
  if(range.kind!=='custom')throw new Error('Choose a valid revenue period.');
  if(!validDay(range.from)||!validDay(range.to)||range.from>range.to||range.to>=day)throw new Error('Choose valid completed dates before today.');
  const days=Math.round((Date.parse(range.to)-Date.parse(range.from))/86400000)+1;
  if(days>366)throw new Error('Choose at most 366 completed days.');
  from=localInstant(range.from);until=localInstant(shiftDay(range.to,1));previousFrom=localInstant(shiftDay(range.from,-days));previousUntil=from;label=dayLabel.format(from)+' – '+dayLabel.format(localInstant(range.to));
 }
 const a=buckets(from,until,range.kind==='today'),b=buckets(previousFrom,previousUntil,range.kind==='today'),length=Math.max(a.length,b.length,1);
 const labels=(rows:Interval[])=>Array.from({length},(_,i)=>rows[i]?(range.kind==='today'?hourLabel:dayLabel).format(new Date(rows[i].from)):'No matching interval');
 return {from:from.toISOString(),until:until.toISOString(),previousFrom:previousFrom.toISOString(),previousUntil:previousUntil.toISOString(),bounds:Array.from({length},(_,i)=>a[i]??null),previousBounds:Array.from({length},(_,i)=>b[i]??null),labels:labels(a),previousLabels:labels(b),label,comparisonLabel:dayLabel.format(previousFrom)+' – '+dayLabel.format(new Date(Math.max(+previousFrom,+previousUntil-1))),timing};
}
