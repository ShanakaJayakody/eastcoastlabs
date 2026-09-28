import type {FulfilmentParams} from './types';
type Raw=Record<string,string|string[]|undefined>;
function choice<T extends string>(value:unknown,allowed:readonly T[],fallback:T):T{return allowed.includes(value as T)?value as T:fallback;}
export function validDate(value:unknown):value is string {
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||value<'1970-01-01')return false;
 const date=new Date(value+'T00:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
}
export function parseFulfilmentParams(raw:Raw):FulfilmentParams {
 let range=choice(raw.range,['all','12w','12m','custom'],'all');
 const good=validDate(raw.from)&&validDate(raw.to)&&raw.from<=raw.to;
 if(range==='custom'&&!good)range='all';
 const view=choice(raw.view,['waiting','unpaid','payments','shipments','quality'],'waiting');
 return {tab:choice(raw.tab,['overview','trends','orders'],'overview'),grain:choice(raw.grain,['week','month'],'week'),range,
 from:range==='custom'?raw.from as string:null,to:range==='custom'?raw.to as string:null,
 stat:choice(raw.stat,['median','mean','p90'],'median'),comparison:choice(raw.comparison,['complete','matched'],'complete'),view,
 sort:choice(raw.sort,['wait','payment','fulfilment','total','milestone'],view==='payments'||view==='shipments'?'milestone':'wait'),
 dir:choice(raw.dir,['asc','desc'],'desc'),page:typeof raw.page==='string'&&/^\d+$/.test(raw.page)?Math.min(1_000_000,Math.max(1,Number(raw.page))):1,
 metric:['payment','fulfilment','total'].includes(raw.metric as string)?raw.metric as FulfilmentParams['metric']:null,
 period:validDate(raw.period)?raw.period:null};
}
export function fulfilmentHref(params:FulfilmentParams,patch:Partial<FulfilmentParams>={},path='/admin/fulfilment') {
 const next={...params,page:1,...patch};const search=new URLSearchParams();
 for(const [key,value]of Object.entries(next))if(value!=null)search.set(key,String(value));
 return `${path}?${search.toString()}`;
}
