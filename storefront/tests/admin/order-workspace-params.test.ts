import {describe,it,expect} from 'vitest';
import {parseOrderWorkspaceParams as parse,orderWorkspaceHref as href,orderWorkspaceScopeKey,safeOrdersReturnTo,parsePackingBatch} from '@/lib/admin/order-workspace/params';
describe('orders URL contract',()=>{
 it('keeps old global searches and explicitly scoped searches distinct',()=>{
  expect(parse({q:' ECL-1048 '}).status).toBe('all');
  expect(parse({status:'pending',q:'ref(1),20%_'})).toMatchObject({status:'pending',q:'ref(1),20%_',sort:'waiting_seconds',dir:'desc'});
 });
 it('normalizes invalid scalars, dates, pages and limits',()=>{
  expect(parse({status:['pending','paid'],sort:'evil',page:'NaN',from:'2026-02-30',to:'2026-02-31',q:'x'.repeat(220)})).toMatchObject({status:'to_fulfil',explicitSort:false,page:1,from:'',to:'',q:'x'.repeat(200)});
  expect(parse({from:'2026-10-03',to:'2026-10-01'})).toMatchObject({from:'',to:''});
  expect(parse({from:'2024-02-29',page:'99999999999999'})).toMatchObject({from:'2024-02-29',page:1000000});
  expect(parse({page:'-3'}).page).toBe(1);
 });
 it('keeps every filter when sorting or paging',()=>{
  const p=parse({status:'pending',q:'ref(1),20%',discount:'VIP_20',shipping:'express',from:'2026-10-01'});
  const url=new URL(href(p,{page:2,sort:'total_cents',dir:'asc',explicitSort:true}),'https://example.test');
  expect(Object.fromEntries(url.searchParams)).toMatchObject({status:'pending',q:'ref(1),20%',discount:'VIP_20',shipping:'express',from:'2026-10-01',page:'2',sort:'total_cents',dir:'asc'});
  expect(parse(Object.fromEntries(new URL(href(p,{status:'shipped'}),'https://example.test').searchParams)).sort).toBe('created_at');
 });
 it('excludes presentation and drawer changes from the selection scope',()=>{
  const p=parse({status:'pending'});
  expect(orderWorkspaceScopeKey(p)).toBe(orderWorkspaceScopeKey({...p,order:'10000000-0000-4000-8000-000000000001',density:'compact',columns:['identity','total']}));
  expect(orderWorkspaceScopeKey({...p,page:2})).not.toBe(orderWorkspaceScopeKey(p));
 });
 it('requires an identity column and eliminates duplicate and unknown columns',()=>{
  expect(parse({columns:'total,total,evil'}).columns).toEqual(['identity','total']);
  expect(parse({columns:'identity'}).columns).toBeNull();
 });
 it.each(['https://evil.test','//evil.test','/admin/orders-evil','/admin/orders/1048','/admin/orders?returnTo=https://evil.test','/admin/orders?order=123','/admin/orders?status=paid&status=pending','/admin/orders#x','/admin%2forders','/admin/orders?evil=1'])('rejects unsafe return URL %s',(raw)=>expect(safeOrdersReturnTo(raw)).toBe('/admin/orders'));
 it('retains a validated internal return context',()=>expect(safeOrdersReturnTo('/admin/orders?status=pending&discount=VIP_20&page=2')).toBe('/admin/orders?status=pending&discount=VIP_20&page=2'));
 it('rejects malformed, duplicate or oversized batches',()=>{
  const id='10000000-0000-4000-8000-000000000001';
  expect(parsePackingBatch(id)).toEqual([id]);
  for(const raw of ['',undefined,'bad',`${id},${id}`,Array(26).fill(id).join(',')])expect(parsePackingBatch(raw)).toBeNull();
 });
});
