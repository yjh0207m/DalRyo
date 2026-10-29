import AsyncStorage from '@react-native-async-storage/async-storage';
import {pendingRuns, queueRun, uploadPendingRun} from '../src/services/runOutbox.service';
import type {RunContext, RunResult} from '../src/types/runSession';
const mockAuth={currentUser:{uid:'owner'}},mockSave=jest.fn(),mockRoom=jest.fn(),mockCommand=jest.fn(),mockActive=jest.fn(),mockServerGet=jest.fn();
jest.mock('@react-native-async-storage/async-storage',()=>require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../src/lib/firebase',()=>({auth:()=>mockAuth,firestore:()=>({collection:()=>({doc:()=>({get:()=>mockServerGet()})})})}));
jest.mock('../src/services/run.service',()=>({saveRunRecord:(...args:unknown[])=>mockSave(...args)}));
jest.mock('../src/services/room.service',()=>({roomRequest:(...args:unknown[])=>mockRoom(...args)}));
jest.mock('../src/services/runJournal.service',()=>({readActiveRun:(...args:unknown[])=>mockActive(...args),commandRun:(...args:unknown[])=>mockCommand(...args)}));
const context:RunContext={uid:'owner',sessionKey:'local',goal:{goalType:'distance',goalValue:3,parkId:'park',courseId:'course'},before:{stageBefore:'egg',totalKmBefore:0,wasFrozen:false},weightKg:60};
const result:RunResult={startedAt:new Date(100000),durationSec:10,distanceKm:0.01,avgSpeedKmh:3.6,calories:1,route:[]};
beforeEach(async()=>{jest.useRealTimers();jest.clearAllMocks();await AsyncStorage.clear();mockAuth.currentUser={uid:'owner'};mockActive.mockResolvedValue(null);mockCommand.mockResolvedValue(null);mockSave.mockResolvedValue({run_id:'owner_100000'});mockRoom.mockResolvedValue({});});
test('offline failures preserve the original result and successful retry clears only its own entry',async()=>{
 const id=await queueRun(context,result);await queueRun(context,result);await queueRun(context,{...result,startedAt:new Date(200000)});
 mockSave.mockRejectedValueOnce(new Error('offline'));await expect(uploadPendingRun('owner',id)).rejects.toThrow('offline');
 expect(await pendingRuns('owner')).toHaveLength(2);
 await uploadPendingRun('owner',id);expect((await pendingRuns('owner')).map(run=>run.id)).toEqual(['owner_200000']);
 expect(mockSave).toHaveBeenLastCalledWith(expect.objectContaining({expectedUid:'owner',startedAt:new Date(100000),parkId:'park',courseId:'course'}));
});
test('the finished native checkpoint is cleared only after the local queue is durable',async()=>{
 mockActive.mockResolvedValue({context,startedAtMs:100000,phase:'finished'});
 (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('disk full'));
 await expect(queueRun(context,result)).rejects.toThrow('disk full');expect(mockCommand).not.toHaveBeenCalled();
 await queueRun(context,result);expect(mockCommand).toHaveBeenCalledWith(expect.objectContaining({startedAtMs:100000}),'clear');
});
test('a different account cannot upload or consume another account queue',async()=>{
 const id=await queueRun(context,result);mockAuth.currentUser={uid:'other'};
 await expect(uploadPendingRun('owner',id)).rejects.toThrow('기록을 시작한 계정');expect(mockSave).not.toHaveBeenCalled();expect(await pendingRuns('owner')).toHaveLength(1);
});
test('a lost acknowledgement times out without deleting the durable copy',async()=>{
 jest.useFakeTimers();const id=await queueRun(context,result);
 let resolve!: (value:unknown)=>void;mockSave.mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));
 const uploading=uploadPendingRun('owner',id).catch(error=>error);
 await jest.advanceTimersByTimeAsync(8001);expect(await uploading).toBeInstanceOf(Error);expect(await pendingRuns('owner')).toHaveLength(1);
 resolve({run_id:id});await Promise.resolve();expect(await pendingRuns('owner')).toHaveLength(1);jest.useRealTimers();
});
test('a competing automatic retry returns the existing canonical record after the queue was acknowledged',async()=>{
 const id=await queueRun(context,result);
 mockServerGet.mockResolvedValue({exists:()=>true,get:()=> 'owner',data:()=>({run_id:id})});
 const values=await Promise.all([uploadPendingRun('owner',id),uploadPendingRun('owner',id)]);
 expect(values).toEqual([{run_id:id},{run_id:id}]);expect(mockSave).toHaveBeenCalledTimes(1);
});
test('closed rooms do not block an already saved private run, transient errors remain retryable',async()=>{
 const id=await queueRun({...context,roomId:'closed'},result);
 mockRoom.mockRejectedValueOnce({code:'functions/unavailable'});
 await expect(uploadPendingRun('owner',id)).rejects.toMatchObject({code:'functions/unavailable'});expect(await pendingRuns('owner')).toHaveLength(1);
 mockRoom.mockRejectedValueOnce({code:'functions/not-found'});await uploadPendingRun('owner',id);expect(await pendingRuns('owner')).toHaveLength(0);
});
