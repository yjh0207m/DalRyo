import React from 'react';
import {Animated, Keyboard, ScrollView, TextInput, TouchableOpacity} from 'react-native';
import Renderer, {act} from 'react-test-renderer';
import {OnboardingScreen} from '../src/screens/auth/OnboardingScreen';
import {REGIONS, bodyInputError, regionFromAddress} from '../src/utils/onboarding';
import {detectOnboardingRegion} from '../src/services/onboardingLocation.service';
import {completeOnboarding} from '../src/services/user.service';

jest.mock('react-native-safe-area-context', () => ({SafeAreaView: require('react-native').View}));
jest.mock('../src/services/onboardingLocation.service', () => ({detectOnboardingRegion: jest.fn()}));
jest.mock('../src/services/user.service', () => ({completeOnboarding: jest.fn()}));
jest.mock('../src/services/character.service', () => ({pickStarterCharacter: () => 'duck'}));

let tree: Renderer.ReactTestRenderer;
const onDone = jest.fn();
const label = (value: string) => tree.root.findAllByType(TouchableOpacity).find(node =>
  node.findAll(n => String(n.type) === 'Text' && n.props.children === value).length > 0)!;
const enter = (name: string, value: string) => tree.root.findAllByType(TextInput).find(n => n.props.accessibilityLabel === name)!.props.onChangeText(value);
async function openRegion() {
  await act(async () => {enter('이름','김달료');enter('달료 펫 이름(닉네임)','오리');});
  await act(async () => label('다음').props.onPress());
  await act(async () => label('건너뛰기').props.onPress());
}
beforeEach(async () => {
  jest.clearAllMocks();
  jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
  jest.spyOn(Animated, 'sequence').mockReturnValue({start: callback => callback?.({finished:true}),stop: jest.fn(),reset:jest.fn()});
  await act(async () => {tree=Renderer.create(<OnboardingScreen onBack={jest.fn()} onDone={onDone} />);});
});
afterEach(async () => {await act(async () => tree.unmount());jest.restoreAllMocks();});

test('all steps share a scrollable keyboard form and dismiss keyboard before advancing', async () => {
  expect(tree.root.findByType(ScrollView).props.keyboardShouldPersistTaps).toBe('handled');
  await act(async () => {enter('이름','김달료');enter('달료 펫 이름(닉네임)','오리');});
  await act(async () => label('다음').props.onPress());
  await act(async () => enter('몸무게','500'));
  await act(async () => label('다음').props.onPress());
  expect(tree.root.findAllByType(TextInput).some(n=>n.props.accessibilityLabel==='몸무게')).toBe(true);
  expect(Keyboard.dismiss).toHaveBeenCalled();
  await act(async () => enter('몸무게','70'));
  await act(async () => label('다음').props.onPress());
  expect(label('● 현재 위치로 설정')).toBeDefined();
  expect(label('다음').props.disabled).toBe(true);
});

test('current location selects a detected region and saves its dialect', async () => {
  (detectOnboardingRegion as jest.Mock).mockResolvedValue(REGIONS.find(r=>r.label==='부산'));
  (completeOnboarding as jest.Mock).mockResolvedValue(undefined);
  await openRegion();
  await act(async () => label('● 현재 위치로 설정').props.onPress());
  expect(label('부산').props.accessibilityState.selected).toBe(true);
  await act(async () => label('다음').props.onPress());
  const save = label('달리기 시작하기');
  let resolveSave!: () => void;
  (completeOnboarding as jest.Mock).mockReturnValue(new Promise<void>(resolve=>{resolveSave=resolve;}));
  await act(async () => {save.props.onPress();save.props.onPress();});
  expect(completeOnboarding).toHaveBeenCalledTimes(1);
  expect(completeOnboarding).toHaveBeenCalledWith(expect.objectContaining({region:'부산',dialect:'gyeong',heightCm:null,weightKg:null}), 'duck');
  await act(async () => resolveSave());
  expect(onDone).toHaveBeenCalledTimes(1);
});

test('permission or network failure is visible and manual region selection remains usable', async () => {
  (detectOnboardingRegion as jest.Mock).mockRejectedValue(new Error('위치 권한을 허용해 주세요.'));
  await openRegion();
  await act(async () => label('● 현재 위치로 설정').props.onPress());
  expect(JSON.stringify(tree.toJSON())).toContain('위치 권한을 허용해 주세요.');
  await act(async () => label('제주').props.onPress());
  expect(label('제주').props.accessibilityState.selected).toBe(true);
  expect(label('다음').props.disabled).toBe(false);
});

test('late GPS result does not overwrite a manual choice', async () => {
  let resolve!: (region: typeof REGIONS[number]) => void;
  (detectOnboardingRegion as jest.Mock).mockReturnValue(new Promise(resolveRegion=>{resolve=resolveRegion;}));
  await openRegion();
  await act(async () => {label('● 현재 위치로 설정').props.onPress();});
  await act(async () => label('제주').props.onPress());
  await act(async () => resolve(REGIONS[0]));
  expect(label('제주').props.accessibilityState.selected).toBe(true);
  expect(label('서울').props.accessibilityState.selected).toBe(false);
});

test('province mapping avoids confusing 경기도 광주시 with 광주광역시', () => {
  expect(regionFromAddress({country_code:'kr',state:'경기도',city:'광주'} )?.label).toBe('경기');
  expect(regionFromAddress({country_code:'kr',city:'광주광역시'})?.label).toBe('광주');
  expect(regionFromAddress({country_code:'us',state:'서울'})).toBeNull();
  expect(regionFromAddress(null)).toBeNull();
  expect(bodyInputError('', '')).toBeNull();
  expect(bodyInputError('abc','70')).not.toBeNull();
  expect(bodyInputError('170','9')).not.toBeNull();
  expect(bodyInputError('170.5','70.2')).toBeNull();
});
