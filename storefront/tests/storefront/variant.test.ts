// @vitest-environment jsdom
import {beforeEach,expect,it,vi} from 'vitest';
import {getExperimentAssignments,recordExperimentAssignment,stableExperimentVariant,type ExperimentConfig} from '@/lib/variant';
import {ANALYTICS_CONSENT_COOKIE,MEASUREMENT_COOKIE} from '@/lib/attribution';

const inactive:ExperimentConfig={id:'homepage-offer',active:false,variants:[{id:'control',weight:1},{id:'holdout',weight:1}]};
const active:ExperimentConfig={...inactive,active:true};
beforeEach(()=>{vi.stubEnv('NEXT_PUBLIC_MEASUREMENT_EXPERIMENTS','homepage-offer:control|holdout');document.cookie=`${ANALYTICS_CONSENT_COOKIE}=granted; Path=/`;document.cookie=`${MEASUREMENT_COOKIE}=; Max-Age=0; Path=/`;});

it('keeps experiments inactive until explicitly configured',()=>{
 expect(recordExperimentAssignment(inactive,'control')).toBeNull();expect(getExperimentAssignments()).toEqual([]);expect(document.cookie).not.toContain(MEASUREMENT_COOKIE);
});
it('maps the same anonymous subject to a stable weighted arm without using a route as randomization',()=>{
 expect(stableExperimentVariant(active,'anonymous-subject-123')).toBe(stableExperimentVariant(active,'anonymous-subject-123'));
 expect(['control','holdout']).toContain(stableExperimentVariant(active,'anonymous-subject-123'));
 expect(stableExperimentVariant(active,'')).toBeNull();
});
it('records a validated active assignment once and does not overwrite it on a later route exposure',()=>{
 expect(recordExperimentAssignment(active,'control')).toEqual({experimentId:'homepage-offer',variant:'control'});
 expect(recordExperimentAssignment(active,'holdout')).toEqual({experimentId:'homepage-offer',variant:'control'});
 expect(getExperimentAssignments()).toEqual([{experimentId:'homepage-offer',variant:'control'}]);
});
