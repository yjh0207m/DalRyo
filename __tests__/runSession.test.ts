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
 const run=new RunAccumulator(state(),false,100000);
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
 const run=new RunAccumulator(snapshot,false,100000);run.fix(fix(37.001,100000));
 expect(run.state.route).toHaveLength(3001);expect(run.state.route.at(-1)?.lat).toBe(37.001);
});
// 37도 근처에서 위도 0.00001도는 약 1.11m
const metersNorth=(m:number)=>37+m/111195;
const walk=(run:RunAccumulator,fromMs:number,seconds:number,stepMeters:number,deliver:(time:number)=>number)=>{
 for(let i=1;i<=seconds;i++){const time=fromMs+i*1000;run.fix({...fix(metersNorth(i*stepMeters),time),receivedAt:deliver(time)});}
};
test('fixes that reach JS late and all at once (screen off) are still counted with their own timestamps',()=>{
 const run=new RunAccumulator(state(),false,100000);
 run.fix(fix(37,100000));
 // 1초마다 3m씩 60초 달린 위치가 화면이 꺼진 동안 쌓였다가 60초 뒤에 한꺼번에 도착
 walk(run,100000,60,3,()=>190000);
 expect(run.state.distanceKm).toBeGreaterThan(0.17);expect(run.state.distanceKm).toBeLessThan(0.19);
 expect(run.state.route.length).toBeGreaterThan(30);
});
test('sparse fixes more than 30 seconds apart still add the straight-line distance when the speed is plausible',()=>{
 const run=new RunAccumulator(state(),false,100000);
 run.fix(fix(37,100000));
 // 45초마다 한 번씩만 위치가 들어오고 그 사이 약 112m(2.5m/s)씩 이동
 for(let i=1;i<=4;i++)run.fix(fix(metersNorth(i*112.5),100000+i*45000));
 expect(run.state.distanceKm).toBeGreaterThan(0.44);expect(run.state.distanceKm).toBeLessThan(0.46);
 expect(run.state.speedKmh).toBeGreaterThan(0);
 expect(run.state.route).toHaveLength(5);
});
test('a long gap is not bridged when the straight-line speed is not running speed or the gap is too long',()=>{
 const run=new RunAccumulator(state(),false,100000);
 run.fix(fix(37,100000));
 // 60초에 5km = 300km/h: 위치 튐이거나 차량 이동
 run.fix(fix(metersNorth(5000),160000));expect(run.state.distanceKm).toBe(0);expect(run.state.speedKmh).toBe(0);
 // 40분 공백은 속도가 그럴듯해도 얼마나 움직였는지 알 수 없다
 run.fix(fix(metersNorth(5500),160000+40*60000));expect(run.state.distanceKm).toBe(0);
 // 그 뒤로는 다시 정상적으로 더한다
 run.fix(fix(metersNorth(5503),160000+40*60000+1000));expect(run.state.distanceKm).toBeGreaterThan(0.002);
});
test('a cached location measured before the run started is ignored, but one measured just after is used',()=>{
 const run=new RunAccumulator(state(),false,100000);
 run.fix(fix(37,90000));run.fix(fix(metersNorth(50),95000));
 expect(run.state.route).toHaveLength(0);
 run.fix(fix(37,101000));run.fix(fix(metersNorth(6),102000));
 expect(run.state.route).toHaveLength(2);expect(run.state.distanceKm).toBeGreaterThan(0.005);
});
test('out-of-order or duplicated late fixes never go backwards or double count',()=>{
 const run=new RunAccumulator(state(),false,100000);
 run.fix(fix(37,101000));run.fix(fix(metersNorth(3),102000));const km=run.state.distanceKm;
 run.fix({...fix(metersNorth(3),102000),receivedAt:150000});
 run.fix({...fix(37,101500),receivedAt:150000});
 expect(run.state.distanceKm).toBe(km);
});

test('a group distance goal freezes the record at the first qualifying GPS fix', () => {
  const snapshot = state();
  snapshot.context.roomId = 'friend-run';
  snapshot.context.goal = {goalType: 'distance', goalValue: 0.1};
  const run = new RunAccumulator(snapshot, false, 100000);
  run.fix(fix(37, 100000));
  walk(run, 100000, 60, 3, () => 190000);
  const finished = run.snapshot(200000);
  expect(finished.phase).toBe('finished');
  expect(finished.distanceKm).toBeGreaterThanOrEqual(0.1);
  expect(finished.distanceKm).toBeLessThan(0.105);
  expect(finished.elapsedMs).toBe(34000);
});
