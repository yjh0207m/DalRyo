import React from 'react';
import {View as MockView} from 'react-native';
import Renderer,{act} from 'react-test-renderer';
import {TogetherScreen} from '../src/screens/together/TogetherScreen';
import type {CharacterDocument} from '../src/types/character.types';
import type {UserDocument} from '../src/types/user.types';
const mockRequest=jest.fn(async(..._args:unknown[])=>({friends:[],invites:[]}));
const mockSaved={run_id:'saved-group-run',distance_km:2,avg_speed_kmh:12,duration_sec:600,avg_pace_sec:300,calories:120,route:[]};
const mockSave=jest.fn(async(..._args:unknown[])=>mockSaved),mockRunning=jest.fn(),mockCompleted=jest.fn();
jest.mock('../src/services/room.service',()=>({newRoomId:()=> 'unused',activeRoomId:async()=> 'room-one',roomRequest:(...args:unknown[])=>mockRequest(...args),publishRoomProgress:jest.fn(),watchRoom:(_id:string,next:(r:unknown)=>void,members:(r:unknown)=>void)=>{next({room_id:'room-one',title:'Friend run',status:'running',host_uid:'me',goal_km:5,member_count:1,capacity:2});members([{uid:'me',display_name:'Me',current_km:0,pace_sec:0,state:'active'}]);return ()=>{};}}));
jest.mock('../src/services/social.service',()=>({myUid:()=> 'me',socialError:(e:Error)=>e.message}));
jest.mock('../src/services/runOutbox.service',()=>({queueRun:async()=> 'pending',uploadPendingRun:(...args:unknown[])=>mockSave(...args)}));
jest.mock('../src/screens/run/RunningScreen',()=>({RunningScreen:(props:unknown)=>{mockRunning(props);return <MockView/>;}}));
jest.mock('../src/screens/run/CompletedRunScreen',()=>({CompletedRunScreen:(props:unknown)=>{mockCompleted(props);return <MockView/>;}}));
jest.mock('react-native-safe-area-context',()=>({SafeAreaView:MockView}));
jest.mock('lucide-react-native',()=>({Check:()=>null,ChevronLeft:()=>null,UserRound:()=>null}));
test('a group completion keeps the start snapshot even after live profile updates',async()=>{
 const user={uid:'me',total_km:49,is_frozen:true,weight_kg:60} as UserDocument;
 const character={stage:'baby',character_type:'rabbit',pet_name:'달료'} as CharacterDocument;
 let tree:Renderer.ReactTestRenderer;
 await act(async()=>{tree=Renderer.create(<TogetherScreen user={user} character={character} onBack={jest.fn()}/>);});
 try{
  await act(()=>tree.root.findByProps({label:'달리기 참여'}).props.onPress());
  await act(()=>tree.update(<TogetherScreen user={{...user,total_km:51,is_frozen:false}} character={{...character,stage:'child'}} onBack={jest.fn()}/>));
  await act(async()=>{await mockRunning.mock.calls.at(-1)![0].onFinish({startedAt:new Date(),distanceKm:2,durationSec:600,avgSpeedKmh:12,calories:120,route:[]});});
  expect(mockCompleted.mock.calls.at(-1)![0]).toMatchObject({run:mockSaved,before:{stageBefore:'baby',totalKmBefore:49,wasFrozen:true}});
 }finally{await act(()=>tree!.unmount());}
});

