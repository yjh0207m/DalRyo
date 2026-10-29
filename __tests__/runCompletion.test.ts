import {runCompletion} from '../src/utils/runCompletion';
import type {RunDocument} from '../src/types/run.types';
const run={distance_km:2,avg_speed_kmh:10} as RunDocument;
test('a first valid run hatches the character from its captured start state',()=>{
  expect(runCompletion({stageBefore:'egg',totalKmBefore:0,wasFrozen:false},run)).toMatchObject({stageBefore:'egg',stageAfter:'baby',totalKmBefore:0,growthDistanceKm:2});
});
test('a frozen runner crossing a growth threshold retains both start conditions',()=>{
  expect(runCompletion({stageBefore:'baby',totalKmBefore:49,wasFrozen:true},run)).toMatchObject({stageBefore:'baby',stageAfter:'child',totalKmBefore:49,wasFrozen:true});
});
test('server-flagged or impossible-speed runs do not preview an unearned hatch',()=>{
  const before={stageBefore:'egg' as const,totalKmBefore:0,wasFrozen:false};
  expect(runCompletion(before,{...run,avg_speed_kmh:30})).toMatchObject({stageAfter:'egg',growthDistanceKm:0});
  expect(runCompletion(before,{...run,flagged:true})).toMatchObject({stageAfter:'egg',growthDistanceKm:0});
});
test('a legacy stage never regresses when totals are lower than its threshold',()=>{
  expect(runCompletion({stageBefore:'runner',totalKmBefore:0,wasFrozen:false},run).stageAfter).toBe('runner');
});
