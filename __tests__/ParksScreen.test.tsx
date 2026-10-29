import React from 'react';
import {View as MockView} from 'react-native';
import Renderer,{act} from 'react-test-renderer';
import {ParksScreen} from '../src/screens/parks/ParksScreen';
const mockLocate=jest.fn(),mockRequest=jest.fn(),mockStart=jest.fn();
jest.mock('../src/services/park.service',()=>({getCurrentParkLocation:()=>mockLocate(),parkRequest:(...args:unknown[])=>mockRequest(...args)}));
jest.mock('../src/services/social.service',()=>({socialError:(e:Error)=>e.message}));
jest.mock('react-native-safe-area-context',()=>({SafeAreaView:MockView}));
jest.mock('lucide-react-native',()=>({ChevronLeft:()=>null,MapPin:()=>null,Trees:()=>null}));
jest.mock('../src/components/maps/RouteMap',()=>({RouteMap:()=> <MockView testID="course-map"/>}));
const park={park_id:'park-one',name:'공원',lat:37.55,lng:126.95,address:'',distance_km:0.5};
const course={course_id:'course-three',name:'순환',distance_km:3,route:[{lat:37.55,lng:126.95,timestamp:0},{lat:37.56,lng:126.95,timestamp:0}]};
let tree:Renderer.ReactTestRenderer;
beforeEach(()=>{jest.clearAllMocks();mockLocate.mockResolvedValue({lat:37.55,lng:126.95});mockRequest.mockImplementation(async(action:string)=>action==='nearby'?{parks:[park],stale:false}:action==='courses'?{courses:[course]}:{week:'2026-10-26',runners:[]});});
afterEach(async()=>{await act(()=>tree.unmount());});
async function render(){await act(()=>{tree=Renderer.create(<ParksScreen onBack={jest.fn()} onStart={mockStart}/>);});}
async function press(label:string){await act(async()=>{await tree.root.findByProps({label}).props.onPress();});}
test('denied location does not send a search or start a run',async()=>{
 mockLocate.mockRejectedValueOnce(new Error('위치 권한 필요'));await render();await press('내 주변 공원 찾기');
 expect(mockRequest).not.toHaveBeenCalled();expect(mockStart).not.toHaveBeenCalled();expect(JSON.stringify(tree.toJSON())).toContain('위치 권한 필요');
});
test('an actual registered course passes its own park, goal, and identifier to running',async()=>{
 await render();await press('내 주변 공원 찾기');await press('코스·주간 랭킹 보기');await press('순환 · 3km');
 expect(tree.root.findAllByProps({testID:'course-map'}).length).toBeGreaterThan(0);await press('3km 코스로 시작');expect(mockStart).toHaveBeenCalledWith(park,3,'course-three');
});
test('parks without courses offer distance goals without inventing a course identifier',async()=>{
 mockRequest.mockImplementation(async(action:string)=>action==='nearby'?{parks:[park],stale:false}:action==='courses'?{courses:[]}:{week:'2026-10-26',runners:[]});
 await render();await press('내 주변 공원 찾기');await press('코스·주간 랭킹 보기');await press('5km');expect(mockStart).toHaveBeenCalledWith(park,5);
});


test('provider failures never send users to location settings',async()=>{
 mockRequest.mockRejectedValue(new Error('공원 서버 연결 실패'));await render();await press('내 주변 공원 찾기');
 expect(tree.root.findAllByProps({label:'위치 설정 열기'})).toHaveLength(0);
 expect(JSON.stringify(tree.toJSON())).toContain('공원 서버 연결 실패');
});
