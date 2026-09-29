import {afterEach,expect,it,vi} from 'vitest';
vi.mock('@/lib/admin/db',()=>({adminDb:()=>{throw new Error('Prediction must not read pack size');}}));
import {deriveSequenceState,type LoadedPerson} from '@/lib/admin/customer-360';
afterEach(()=>vi.unstubAllEnvs());
const person={summary:{email:'buyer@example.test',hasOrders:true,lastOrderAt:null},orders:[{id:'order',status:'completed',order_number:'ECL-1',created_at:'2026-09-01T00:00:00Z',shipped_at:'2026-09-02T00:00:00Z'}],cart:null,outbox:[],pausedSequences:new Set(),subscriberRows:[],reviews:[]} as unknown as LoadedPerson;
it('explicitly predicts disabled reorder timing without creating a send-now stage',async()=>{vi.stubEnv('REORDER_REMINDER_DAYS','');const row=(await deriveSequenceState(person)).find(s=>s.id==='replenishment');expect(row).toMatchObject({active:false,disabled:true,paused:false,stages:[],nextEtaMs:null});expect(row?.context).toContain('REORDER_REMINDER_DAYS');});
it('uses the same configured timing and suppresses an older order once a newer order exists',async()=>{vi.stubEnv('REORDER_REMINDER_DAYS','45');const row=(await deriveSequenceState(person)).find(s=>s.id==='replenishment');expect(row?.stages[0].label).toBe('Reorder reminder (45 days after dispatch)');expect((await deriveSequenceState({...person,orders:[...person.orders,{...person.orders[0],id:'new',status:'pending',created_at:'2026-09-10T00:00:00Z',shipped_at:null}]})).some(s=>s.id==='replenishment')).toBe(false);});
it('anchors the single review stage to completion, never to shipment or a historical completion without a timestamp',async()=>{
 const completedAt=new Date().toISOString();
 for(const order of [{...person.orders[0],status:'shipped',completed_at:null},{...person.orders[0],completed_at:null}]) {
  expect((await deriveSequenceState({...person,orders:[order]})).some(s=>s.id==='post_purchase_review')).toBe(false);
 }
 const rows=await deriveSequenceState({...person,orders:[{...person.orders[0],completed_at:completedAt}]});
 const review=rows.find(s=>s.id==='post_purchase_review');
 expect(review).toMatchObject({anchorAt:completedAt,orderId:'order'});
 expect(review?.stages).toHaveLength(1);
 expect(review?.stages[0]).toMatchObject({template:'post_purchase_review',relatedId:'order:pp:review'});
});
it.each(['post_purchase_review','arrival_checkin'] as const)('shows the actual completion %s rather than an older email of the other type',async(template)=>{
 const completedAt=new Date().toISOString();
 const legacy={id:'old',related_id:'order:pp:review',template:template==='arrival_checkin'?'post_purchase_review':'arrival_checkin',status:'sent',created_at:'2026-09-03T00:00:00Z',sent_at:'2026-09-03T00:00:00Z'};
 const current={id:'current',related_id:'order:pp:review',template,status:'failed',created_at:completedAt,sent_at:null,payload:{completed_at:completedAt}};
 const rows=await deriveSequenceState({...person,orders:[{...person.orders[0],completed_at:completedAt}],outbox:[current,legacy]} as LoadedPerson);
 expect(rows.find(s=>s.id==='post_purchase_review')?.stages[0]).toMatchObject({template,state:'failed',outboxId:'current'});
});
