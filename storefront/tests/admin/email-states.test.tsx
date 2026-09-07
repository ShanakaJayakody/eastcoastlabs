// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { deriveStages, WELCOME_STAGES, welcomeRelatedId } from '@/lib/admin/sequences';
import SequenceStepper from '@/components/admin/SequenceStepper';
afterEach(cleanup);
import { ALL_TEMPLATES, samplePayload } from '@/lib/email/samples';
const m=vi.hoisted(()=>({rows:[] as Record<string,unknown>[]}));
vi.mock('@/lib/admin/db',()=>({adminDb:()=>({from:()=>{
 const q={select:()=>q,gte:()=>q,lt:()=>q,order:()=>q,range:()=>Promise.resolve({data:m.rows,error:null})};return q;
}})}));
import { emailPerformance } from '@/lib/admin/reports';
import type { WindowMeta } from '@/lib/admin/order-queries';
it.each(['queued','sending','failed','dead'])('does not display a %s delivery as sent',status=>{
 const stages=deriveStages(WELCOME_STAGES,new Date().toISOString(),n=>welcomeRelatedId('a@example.test',n),[
  {id:'outbox',template:'welcome_1',related_id:welcomeRelatedId('a@example.test',1),status,created_at:new Date().toISOString(),sent_at:null},
 ]);
 expect(stages[0].state).toBe(status);
 render(<SequenceStepper steps={[stages[0]]}/>);
 expect(screen.getByText(status==='dead'?'Delivery stopped — reconcile provider':status==='failed'?'Retry scheduled':status==='sending'?'Sending': 'Queued')).not.toBeNull();
});
it('recognizes a confirmed lifetime welcome as completed and advances to the later touch',()=>{
 const stages=deriveStages(WELCOME_STAGES,new Date().toISOString(),n=>welcomeRelatedId('a@example.test',n===1?1:3),[
  {id:'outbox',template:'welcome_1',related_id:'a@example.test:welcome:1',status:'sent',created_at:new Date().toISOString(),sent_at:new Date().toISOString()},
 ]);
 expect(stages.map(s=>s.state)).toEqual(['sent','next']);
});
it('retains terminal delivery failures in email performance totals',async()=>{
 m.rows=['dead','failed','sending','queued'].map((status,i)=>({id:String(i),template:'welcome_1',status}));
 const result=await emailPerformance({startIso:'2026-01-01',endIso:'2027-01-01'} as WindowMeta);
 expect(result.totals).toMatchObject({sent:0,failed:2});
});
it.each(['admin_daily_brief','subscription_confirmation'] as const)('includes %s in the preview gallery with a usable payload',template=>{
 expect(ALL_TEMPLATES.map(t=>t.id)).toContain(template);
 expect(Object.keys(samplePayload(template)).length).toBeGreaterThan(0);
});
