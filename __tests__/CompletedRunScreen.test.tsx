import React, {useEffect} from 'react';
import {View as MockView} from 'react-native';
import Renderer, {act} from 'react-test-renderer';
import {CompletedRunScreen} from '../src/screens/run/CompletedRunScreen';
import type {RunDocument} from '../src/types/run.types';
import type {CharacterDocument} from '../src/types/character.types';
type CompletionProps=React.ComponentProps<typeof import('../src/screens/run/RunCompleteScreen').RunCompleteScreen>;
type ChildProps={run?:RunDocument;character:CharacterDocument|null;onBack:()=>void};
const mockComplete=jest.fn();
const mockShare=jest.fn();
const mockDetail=jest.fn();
const mockRevealMount=jest.fn();
function MockRunComplete(props:CompletionProps){mockComplete(props);useEffect(()=>{mockRevealMount();},[]);return <MockView testID="complete"/>;}
jest.mock('../src/screens/run/RunCompleteScreen',()=>({RunCompleteScreen:MockRunComplete}));
jest.mock('../src/screens/run/ShareStudioScreen',()=>({ShareStudioScreen:(props:ChildProps)=>{mockShare(props);return <MockView testID="share"/>;}}));
jest.mock('../src/screens/run/RunDetailScreen',()=>({RunDetailScreen:(props:ChildProps)=>{mockDetail(props);return <MockView testID="detail"/>;}}));
const run={run_id:'saved',distance_km:2,duration_sec:600,avg_pace_sec:300,avg_speed_kmh:12,calories:120,route:[]} as unknown as RunDocument;
const before={stageBefore:'baby' as const,totalKmBefore:49,wasFrozen:true};
const character={stage:'child',character_type:'rabbit',pet_name:'달료'} as CharacterDocument;
let tree:Renderer.ReactTestRenderer;
beforeEach(()=>jest.clearAllMocks());
afterEach(async()=>{await act(()=>tree.unmount());});
async function render(onRecordBack?:()=>void){await act(()=>{tree=Renderer.create(<CompletedRunScreen run={run} before={before} character={character} onClose={jest.fn()} onRecordBack={onRecordBack}/>);});}
test('saved metrics and the original growth and frozen state reach completion',async()=>{
  await render();expect(mockComplete.mock.calls.at(-1)![0]).toMatchObject({distanceKm:2,stageBeforeRun:'baby',stageAfterRun:'child',totalKmBefore:49,wasFrozen:true,route:[]});
});
test('sharing and returning preserve the completed run without replaying the reveal',async()=>{
  await render();await act(()=>mockComplete.mock.calls.at(-1)![0].onTakePhoto());
  expect(mockShare.mock.calls.at(-1)![0].run).toBe(run);
  await act(()=>mockShare.mock.calls.at(-1)![0].onBack());
  expect(tree.root.findAllByProps({testID:'share'})).toHaveLength(0);
  expect(mockRevealMount).toHaveBeenCalledTimes(1);
});
test('record detail receives the same saved run and returns to completion in group sessions',async()=>{
  await render();await act(()=>mockComplete.mock.calls.at(-1)![0].onViewRecord());
  expect(mockDetail.mock.calls.at(-1)![0].run).toBe(run);
  await act(()=>mockDetail.mock.calls.at(-1)![0].onBack());
  expect(tree.root.findAllByProps({testID:'detail'})).toHaveLength(0);
});
test('solo detail retains its existing back-to-records navigation',async()=>{
  const back=jest.fn();await render(back);await act(()=>mockComplete.mock.calls.at(-1)![0].onViewRecord());
  await act(()=>mockDetail.mock.calls.at(-1)![0].onBack());expect(back).toHaveBeenCalledTimes(1);
});
