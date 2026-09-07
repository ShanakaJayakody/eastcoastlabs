import {beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({person:vi.fn(),states:vi.fn(),queue:vi.fn()}));
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}));
vi.mock('@/lib/admin/auth',()=>({requireAdmin:async()=>({email:'admin@example.test'})}));
vi.mock('@/lib/admin/audit',()=>({logAudit:async()=>{}}));
vi.mock('@/lib/admin/customer-360',()=>({loadPerson:m.person,deriveSequenceState:m.states}));
vi.mock('@/lib/admin/email',()=>({queueEmail:m.queue}));
vi.mock('@/lib/email/sender',()=>({sendImmediately:vi.fn()}));
vi.mock('@/lib/email/unsubscribe',()=>({unsubscribeUrl:()=> 'https://example.test/unsubscribe'}));
vi.mock('@/lib/admin/db',()=>({adminDb:()=>({from:()=>({select:()=>({eq:async()=>({data:[{product_name:'Test product'}],error:null})})})})}));
import {sendStageNow} from '@/app/admin/(dashboard)/customers/actions';
import {samplePayload} from '@/lib/email/samples';
const orderId='31a1e654-4577-4176-99d8-255613de2911';
const episodeId='41a1e654-4577-4176-99d8-255613de2911';
beforeEach(()=>{vi.clearAllMocks();m.queue.mockResolvedValue('outbox');m.person.mockResolvedValue({summary:{unsubscribedAt:null},orders:[{id:orderId,order_number:'ECL-1'}],cart:{current_episode_id:episodeId,cart:[],subtotal_cents:1000}});});
it.each(['post_purchase_review','post_purchase_review_reminder'])('binds manual %s to an order identity, never a caller-supplied review URL',async template=>{
 m.states.mockResolvedValue([{id:'post_purchase_review',orderId,stages:[{stage:1,state:'next',label:'Review',template,relatedId:'review-key'}]}]);
 expect((await sendStageNow('buyer@example.test','post_purchase_review',1)).ok).toBe(true);
 const payload=m.queue.mock.calls[0][0].payload;
 expect(payload.order_id).toBe(orderId);expect(payload).not.toHaveProperty('review_url');
});
it('binds manual recovery to the current immutable capture episode',async()=>{
 m.states.mockResolvedValue([{id:'cart_recovery',stages:[{stage:1,state:'next',label:'Recovery',template:'abandoned_cart',relatedId:'cart-key'}]}]);
 expect((await sendStageNow('buyer@example.test','cart_recovery',1)).ok).toBe(true);
 expect(m.queue.mock.calls[0][0].payload.recovery_episode_id).toBe(episodeId);
});
it.each(['post_purchase_review','post_purchase_review_reminder'] as const)('provides a signable order identity in the %s preview',template=>{
 expect(samplePayload(template).order_id).toMatch(/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/);
 expect(samplePayload(template)).not.toHaveProperty('review_url');
});
