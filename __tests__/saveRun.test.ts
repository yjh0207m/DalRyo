import {saveRunRecord} from '../src/services/run.service';
const mockSaved = new Map<string, Record<string,unknown>>();
let mockLostResponse=false;
let mockCreates=0;
jest.mock('../src/lib/firebase',()=>({auth:()=>({currentUser:{uid:'runner'}}),firestore:()=>({collection:()=>({doc:(id:string)=>({id,set:async(data:Record<string,unknown>)=>{
  if(mockSaved.has(id))throw new Error('create only');
  mockSaved.set(id,data);mockCreates++;if(mockLostResponse)throw new Error('response lost');
},get:async()=>({exists:()=>mockSaved.has(id),get:(key:string)=>mockSaved.get(id)?.[key],data:()=>mockSaved.get(id)})})})})}));
jest.mock('@react-native-firebase/firestore',()=>({__esModule:true,default:{Timestamp:{fromDate:(date:Date)=>date},FieldValue:{serverTimestamp:()=> 'server-time'}}}));
const input={goalType:'free' as const,goalValue:null,startedAt:new Date(2026,9,27,10),durationSec:300,distanceKm:1,avgSpeedKmh:12,calories:60,route:[]};
beforeEach(()=>{mockSaved.clear();mockCreates=0;mockLostResponse=false;});
test('lost acknowledgement and repeated save cannot create duplicate rewarded runs',async()=>{
  mockLostResponse=true;
  const first=await saveRunRecord(input);
  const retry=await saveRunRecord(input);
  expect(first.run_id).toBe(retry.run_id);
  expect(mockCreates).toBe(1);
  expect(mockSaved.size).toBe(1);
});
test('different running sessions remain distinct',async()=>{
  await saveRunRecord(input);
  await saveRunRecord({...input,startedAt:new Date(input.startedAt.getTime()+1000)});
  expect(mockCreates).toBe(2);
});
