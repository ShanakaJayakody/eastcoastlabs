import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({insert:vi.fn()}));
vi.mock('next/server',()=>({after:vi.fn()}));
vi.mock('@/lib/admin/db',()=>({adminDb:()=>({from:()=>({upsert:(row:unknown)=>{m.insert(row);return {select:()=>({maybeSingle:async()=>({data:{id:'row'},error:null})})};}})})}));
import {queueEmail} from '@/lib/admin/email';
afterEach(()=>vi.unstubAllEnvs());beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('RETENTION_HOLDOUT_PERCENT','100');vi.stubEnv('RETENTION_HOLDOUT_KEY','long-enough-test-only-hmac-key');vi.stubEnv('RETENTION_EXPERIMENT_ID','retention-v1');});
it('persists a stable holdout assignment with the eligible intent without allowing a caller to override it',async()=>{await queueEmail({to:'Buyer@example.test',template:'replenishment',relatedId:'order:replenishment',payload:{retention_experiment:{arm:'treatment'}}});expect(m.insert.mock.calls[0][0]).toMatchObject({to_email:'buyer@example.test',payload:{retention_experiment:{id:'retention-v1',arm:'holdout',percent:100}}});});
it('never assigns a transactional payment reminder to a marketing holdout',async()=>{await queueEmail({to:'buyer@example.test',template:'payment_reminder'});expect(m.insert.mock.calls[0][0].payload).not.toHaveProperty('retention_experiment');});
