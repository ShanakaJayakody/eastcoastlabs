import {describe,expect,it} from 'vitest';
import {routeFiles,evaluateBudget} from '../scripts/route-budgets.mjs';
describe('route JavaScript budgets',()=>{
 it('includes parent layouts and deduplicates shared chunks, excluding unrelated routes and CSS',()=>{
  expect(routeFiles({pages:{'/layout':['shared.js','root.js'],'/(store)/layout':['shared.js','store.js','style.css'],'/(store)/shop/page':['shared.js','shop.js'],'/admin/layout':['admin.js']}},'/(store)/shop/page')).toEqual(['shared.js','root.js','store.js','shop.js']);
 });
 it('fails if a required route vanishes or exceeds its explicit gzip allowance',()=>{
  expect(()=>routeFiles({pages:{}},'/missing/page')).toThrow(/missing/i);
  expect(evaluateBudget(10001,10)).toBe(false);
  expect(evaluateBudget(10000,10)).toBe(true);
 });
});
