import React from 'react';
import {Text as MockText} from 'react-native';
import Renderer, {act} from 'react-test-renderer';
import App from '../App';
const mockFetchUser = jest.fn();
const mockFetchProfile = jest.fn();
const mockSubscribe = jest.fn((..._args: unknown[]) => jest.fn());
let mockListener: (user: {uid:string}|null) => void;
const mockAuth: {currentUser:{uid:string}|null;onAuthStateChanged: jest.Mock} = {currentUser:{uid:'test'}, onAuthStateChanged:jest.fn(listener=>{mockListener=listener;return jest.fn();})};
jest.mock('@react-native-firebase/auth',()=>({__esModule:true,default:()=>mockAuth}));
jest.mock('../src/services/user.service',()=>({fetchCurrentUserDocument:()=>mockFetchUser()}));
jest.mock('../src/services/profile.service',()=>({fetchMyProfile:()=>mockFetchProfile(),subscribeMyProfile:(...args: unknown[])=>mockSubscribe(...args)}));
jest.mock('react-native-safe-area-context',()=>({SafeAreaProvider:({children}: {children:React.ReactNode})=>children,SafeAreaView:require('react-native').View}));
jest.mock('../src/screens/auth/SplashScreen',()=>({AuthStartScreen:()=> <MockText>로그인 시작</MockText>}));
jest.mock('../src/screens/auth/LoginScreen',()=>({PhoneLoginScreen:()=> <MockText>전화 인증</MockText>}));
jest.mock('../src/screens/auth/OnboardingScreen',()=>({OnboardingScreen:()=> <MockText>새 계정 등록</MockText>}));
jest.mock('../src/screens/main/MainAppScreen',()=>({MainAppScreen:()=> <MockText>내 앱</MockText>}));
let tree: Renderer.ReactTestRenderer;
beforeEach(()=>{jest.clearAllMocks();mockAuth.currentUser={uid:'test'};mockFetchUser.mockResolvedValue({uid:'test'});mockFetchProfile.mockResolvedValue({user:{uid:'test',dialect:'std'},character:null});});
afterEach(async()=>{if(tree)await act(()=>tree.unmount());});
async function renderUser(user:{uid:string}|null){await act(()=>{tree=Renderer.create(<App/>);});await act(async()=>{mockListener(user);});}
function renderedText(){return JSON.stringify(tree.toJSON());}
test('signed-in accounts open the app after profile loading',async()=>{await renderUser({uid:'test'});expect(renderedText()).toContain('내 앱');});
test('profile read failure offers retry without treating an existing account as new',async()=>{mockFetchUser.mockRejectedValueOnce(new Error('offline'));await renderUser({uid:'test'});expect(renderedText()).toContain('다시 시도');expect(renderedText()).not.toContain('새 계정 등록');});
test('only a confirmed missing user document opens registration',async()=>{mockFetchUser.mockResolvedValue(null);await renderUser({uid:'test'});expect(renderedText()).toContain('새 계정 등록');});
test('signed-out accounts open login',async()=>{mockAuth.currentUser=null;await renderUser(null);expect(renderedText()).toContain('로그인 시작');});

