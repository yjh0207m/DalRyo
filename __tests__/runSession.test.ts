import {RunAccumulator, sessionResult} from '../src/utils/runSession';
import type {RunSessionSnapshot} from '../src/types/runSession';
function state(): RunSessionSnapshot {return {version:1,context:{uid:'owner',sessionKey:'test',goal:{goalType:'free',goalValue:null},before:{stageBefore:'baby',totalKmBefore:2,wasFrozen:false},weightKg:60},phase:'running',startedAtMs:100000,updatedAtMs:100000,elapsedMs:0,distanceKm:0,speedKmh:0,route:[],gpsStatus:'tracking'};}
const fix=(lat:number,time:number,accuracyM=5)=>({lat,lng:127,timestamp:time,receivedAt:time,accuracyM,speedMps:null});
test('elapsed time catches up after suspension without counting timer callbacks',()=>{
 const run=new RunAccumulator(state(),false,100000);
 expect(run.snapshot(160000).elapsedMs).toBe(60000);
 run.change('paused',160000);expect(run.snapshot(220000).elapsedMs).toBe(60000);
 run.change('running',220000);expect(run.snapshot(250000).elapsedMs).toBe(90000);
});
test('paused movement and a long GPS outage are never joined into recorded distance',()=>{
 const run=new RunAccumulator(state(),false,100000);
 run.fix(fix(37,100000));run.fix(fix(37.0001,110000));const km=run.state.distanceKm;
 run.change('paused',110000);run.fix(fix(38,120000));run.change('running',130000);
 run.fix(fix(38,130000));expect(run.state.distanceKm).toBe(km);
 run.fix(fix(39,200000));expect(run.state.distanceKm).toBe(km);
});
test('poor accuracy, duplicates, old fixes, and position spikes cannot inflate distance',()=>{
 const run=new RunAccumulator(state());
 run.fix(fix(37,100000));run.fix(fix(37.01,101000));run.fix(fix(38,102000,80));run.fix(fix(37.1,100000));
 run.fix({...fix(37.1,99000),receivedAt:140000});expect(run.state.distanceKm).toBe(0);
 run.fix(fix(37.0001,110000));expect(run.state.distanceKm).toBeGreaterThan(0.01);expect(run.state.distanceKm).toBeLessThan(0.02);
});
test('a cold restart recovers only the checkpoint and waits for an explicit resume',()=>{
 const snapshot={...state(),elapsedMs:12000,distanceKm:0.1};
 const run=new RunAccumulator(snapshot,true,999999);
 expect(run.snapshot(1999999)).toMatchObject({phase:'paused',elapsedMs:12000,interrupted:true,distanceKm:0.1});
});
test('an immediate finish still yields a valid one-second result with stable identity',()=>{
 const result=sessionResult({...state(),phase:'finished'});
 expect(result.durationSec).toBe(1);expect(result.avgSpeedKmh).toBe(0);expect(result.startedAt.getTime()).toBe(100000);
});
test('route thinning keeps new points within the Firestore document budget',()=>{
 const snapshot=state();snapshot.route=Array.from({length:6000},(_,i)=>({lat:37,lng:127,timestamp:i}));
 const run=new RunAccumulator(snapshot);run.fix(fix(37.001,100000));
 expect(run.state.route).toHaveLength(3001);expect(run.state.route.at(-1)?.lat).toBe(37.001);
});
