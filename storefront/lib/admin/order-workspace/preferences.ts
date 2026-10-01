import {ORDER_COLUMNS,parseOrderWorkspaceParams} from './params';
import {defaultOrderColumns} from './presentation';
import type {OrderColumn,OrderPreferences,OrderWorkspaceParams,StoredOrderView} from './types';
export const defaultOrderPreferences=():OrderPreferences=>({version:1,columns:null,density:'comfortable',views:[]});
export const orderPreferencesKey=(userId:string)=>`ecl:admin:orders:v1:${userId}`;
function columns(value:unknown):OrderColumn[]|null {
 if(!Array.isArray(value))return null;
 const rest=[...new Set(value.filter((c):c is OrderColumn=>ORDER_COLUMNS.includes(c)&&c!=='identity'))];
 return rest.length?['identity',...rest]:null;
}
function structural(p:OrderWorkspaceParams):StoredOrderView['filters'] {
 const {status,from,to,discount,shipping,sort,dir,explicitSort}=p;
 return {status,from,to,discount,shipping,sort,dir,explicitSort};
}
export function parseOrderPreferences(raw:string|null):OrderPreferences {
 try {
  const r=JSON.parse(raw??'null');if(!r||r.version!==1)return defaultOrderPreferences();
  const views:StoredOrderView[]=[];
  if(Array.isArray(r.views))for(const v of r.views){
   if(views.length===10)break;
   if(!v||typeof v.id!=='string'||!v.id||typeof v.name!=='string'||!v.filters||typeof v.filters!=='object')continue;
   const name=v.name.trim(),cols=columns(v.columns);
   if(!name||name.length>40||!cols||views.some(x=>x.id===v.id||x.name.toLowerCase()===name.toLowerCase()))continue;
   const f=v.filters;
   const p=parseOrderWorkspaceParams({status:f.status,from:f.from,to:f.to,discount:f.discount,shipping:f.shipping,sort:f.explicitSort?f.sort:undefined,dir:f.dir});
   views.push({id:v.id,name,filters:structural(p),columns:cols,density:v.density==='compact'?'compact':'comfortable'});
  }
  return {version:1,columns:columns(r.columns),density:r.density==='compact'?'compact':'comfortable',views};
 } catch {return defaultOrderPreferences();}
}
export const serializeOrderPreferences=(p:OrderPreferences)=>JSON.stringify(parseOrderPreferences(JSON.stringify(p)));
export function resolveOrderLayout(p:OrderWorkspaceParams,prefs:OrderPreferences){return {columns:p.columns??prefs.columns??defaultOrderColumns(p.status),density:p.density??prefs.density};}
export function saveOrderView(prefs:OrderPreferences,current:OrderWorkspaceParams,label:string,existingId?:string):OrderPreferences {
 const name=label.trim();if(!name||name.length>40)throw new Error('Use a view name between 1 and 40 characters.');
 if(prefs.views.some(v=>v.id!==existingId&&v.name.toLowerCase()===name.toLowerCase()))throw new Error('A view with that name already exists.');
 if(!existingId&&prefs.views.length>=10)throw new Error('You can save up to 10 views.');
 const old=prefs.views.find(v=>v.id===existingId);
 const view:StoredOrderView=old?{...old,name}:{id:crypto.randomUUID(),name,filters:structural(current),...resolveOrderLayout(current,prefs)};
 return {...prefs,views:old?prefs.views.map(v=>v.id===existingId?view:v):[...prefs.views,view]};
}
type StoragePort=Pick<Storage,'getItem'|'setItem'>;
export function readOrderPreferences(id:string,storage:StoragePort|null){try{return parseOrderPreferences(storage?.getItem(orderPreferencesKey(id))??null);}catch{return defaultOrderPreferences();}}
export function writeOrderPreferences(id:string,value:OrderPreferences,storage:StoragePort|null){try{if(!storage)return false;storage.setItem(orderPreferencesKey(id),serializeOrderPreferences(value));return true;}catch{return false;}}
