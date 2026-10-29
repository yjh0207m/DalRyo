import React from 'react';
import {View as MockView} from 'react-native';
import Renderer, {act} from 'react-test-renderer';
import {InventoryScreen} from '../src/screens/profile/InventoryScreen';
import {CharacterView} from '../src/components/character/CharacterView';
import type {CharacterDocument} from '../src/types/character.types';
const mockRequest = jest.fn();
jest.mock('../src/services/inventory.service', () => ({inventoryRequest: (...args: unknown[]) => mockRequest(...args)}));
jest.mock('../src/components/character/CharacterView', () => ({CharacterView: () => null}));
jest.mock('react-native-safe-area-context', () => ({SafeAreaView: MockView}));
jest.mock('lucide-react-native', () => ({ChevronLeft: () => null}));
const character = {uid:'owner',character_type:'rabbit',stage:'baby',pet_name:'달료'} as CharacterDocument;
const initial = {owned:['mint-glow','gold-stars'],equipped:{},totalKm:0};
let tree: Renderer.ReactTestRenderer;
beforeEach(() => {mockRequest.mockReset();mockRequest.mockResolvedValue(initial);});
afterEach(async () => {await act(() => tree?.unmount());});
async function render(mode: 'owned' | 'all' = 'owned') {await act(async () => {tree=Renderer.create(<InventoryScreen character={character} initialMode={mode} onBack={jest.fn()}/>);});}
async function button(label: string) {await act(async () => {await tree.root.findByProps({label}).props.onPress();});}
async function preview(name: string) {await act(() => tree.root.findByProps({accessibilityLabel:`${name} 미리보기`}).props.onPress());}
test('preview is local until applied and a successful equip uses the canonical server result', async () => {
  await render();await preview('응원별');expect(mockRequest).toHaveBeenCalledTimes(1);
  expect(tree.root.findByType(CharacterView).props.equipped).toEqual({accessory:'gold-stars'});
  mockRequest.mockResolvedValue({...initial,equipped:{accessory:'gold-stars'}});
  await button('응원별 장착하기');expect(mockRequest).toHaveBeenLastCalledWith('equip',{itemId:'gold-stars'});
  expect(tree.root.findByType(CharacterView).props.equipped).toEqual({accessory:'gold-stars'});
});
test('locked items can be previewed but not equipped', async () => {
  await render('all');await preview('꽃잎 응원');
  expect(tree.root.findByProps({label:'누적 10km 달리면 받을 수 있어요'}).props.disabled).toBe(true);
  expect(mockRequest).toHaveBeenCalledTimes(1);
  await button('미리보기 취소');expect(tree.root.findByType(CharacterView).props.equipped).toEqual({});
});
test('save failure preserves the preview and does not pretend the item is equipped', async () => {
  await render();await preview('응원별');mockRequest.mockRejectedValueOnce(new Error('offline'));
  await button('응원별 장착하기');
  expect(JSON.stringify(tree.toJSON())).toContain('연결을 확인');
  expect(tree.root.findByProps({label:'응원별 장착하기'}).props.disabled).toBe(false);
  expect(JSON.stringify(tree.toJSON())).not.toContain('장착했어요.');
});
test('unequipping preserves other slots and a newly mounted screen restores server state', async () => {
  mockRequest.mockResolvedValue({...initial,equipped:{back:'mint-glow',accessory:'gold-stars'}});
  await render();expect(tree.root.findByType(CharacterView).props.equipped).toEqual({back:'mint-glow',accessory:'gold-stars'});
  mockRequest.mockResolvedValue({...initial,equipped:{back:'mint-glow'}});
  await button('소품 해제');expect(mockRequest).toHaveBeenLastCalledWith('unequip',{slot:'accessory'});
  expect(tree.root.findByType(CharacterView).props.equipped).toEqual({back:'mint-glow'});
  await act(() => tree.unmount());await render();
  expect(tree.root.findByType(CharacterView).props.equipped).toEqual({back:'mint-glow'});
});
test('repeated presses while a request is pending send only one mutation', async () => {
  await render();await preview('응원별');
  let finish!: (value: typeof initial) => void;
  mockRequest.mockImplementationOnce(() => new Promise(resolve => {finish=resolve;}));
  const apply=tree.root.findByProps({label:'응원별 장착하기'}).props.onPress;
  await act(() => {apply();apply();});
  expect(mockRequest.mock.calls.filter(([action]) => action==='equip')).toHaveLength(1);
  expect(tree.root.findByProps({label:'응원별 장착하기'}).props.disabled).toBe(true);
  await act(async () => {finish(initial);});
});
