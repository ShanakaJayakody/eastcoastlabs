import { expect,it,vi } from 'vitest';
const m=vi.hoisted(()=>({rows:[] as unknown[]}));
vi.mock('@/lib/supabase',()=>({supabasePublic:()=>({from:()=>({select:()=>Promise.resolve({data:m.rows,error:null})})})}));
import { getAllCoa } from '@/lib/coa';
it('does not present seed or unverified broken documents as published proof',async()=>{m.rows=[{batch_id:'old',compound:'BPC-157',purity_pct:99,coa_url:'https://eastcoastlabs.com.au/coa/old.pdf'}];expect(await getAllCoa()).toEqual([]);});
it('keeps a successful empty proof catalogue empty',async()=>{m.rows=[];expect(await getAllCoa()).toEqual([]);});
