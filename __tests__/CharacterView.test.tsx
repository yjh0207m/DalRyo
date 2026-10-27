import React from 'react';
import {Image} from 'react-native';
import {act, create, type ReactTestRenderer} from 'react-test-renderer';
import {CharacterView} from '../src/components/character/CharacterView';
import {RiveCharacter} from '../src/components/character/RiveCharacter';

const mockRemote = jest.fn();
jest.mock('../src/components/character/characterAssets', () => ({
  bundledCharacterRive: (type: string, stage: string) => type === 'rabbit' && stage === 'baby' ? 42 : null,
  bundledCharacterStepMs: () => 266.667,
  resolveCharacterRiveUrl: (...args: unknown[]) => mockRemote(...args),
  resolveCharacterSource: () => ({uri: 'https://example.test/character.png'}),
}));
jest.mock('../src/components/character/RiveCharacter', () => ({RiveCharacter: jest.fn(() => null)}));

let renderer: ReactTestRenderer;
beforeEach(() => {mockRemote.mockReset(); mockRemote.mockResolvedValue(null);});
afterEach(async () => {await act(async () => renderer?.unmount());});

test('bundled baby renders offline without requesting a remote Rive file', async () => {
  await act(async () => {renderer = create(<CharacterView type="rabbit" stage="baby" />);});
  expect(renderer.root.findByType(RiveCharacter).props.source).toBe(42);
  expect(mockRemote).not.toHaveBeenCalled();
});

test('stone uses the layered Rive material while external outfits retain PNG rendering', async () => {
  await act(async () => {renderer = create(<CharacterView type="rabbit" stage="baby" motion="stone" />);});
  expect(renderer.root.findByType(RiveCharacter).props.motion).toBe('stone');
  await act(async () => {renderer.update(<CharacterView type="rabbit" stage="baby" outfitLayers={{hat: {uri: 'hat.png'}}} />);});
  expect(renderer.root.findAllByType(RiveCharacter)).toHaveLength(0);
  await act(async () => {renderer.update(<CharacterView type="rabbit" stage="baby" />);});
  expect(renderer.root.findAllByType(RiveCharacter)).toHaveLength(1);
});

test('fatal native errors fall back to PNG and are not retried on every render', async () => {
  await act(async () => {renderer = create(<CharacterView type="rabbit" stage="baby" />);});
  await act(async () => renderer.root.findByType(RiveCharacter).props.onError());
  expect(renderer.root.findAllByType(RiveCharacter)).toHaveLength(0);
  await act(async () => {renderer.update(<CharacterView type="rabbit" stage="baby" motion="run" />);});
  expect(renderer.root.findAllByType(RiveCharacter)).toHaveLength(0);
  expect(renderer.root.findAllByType(Image).length).toBeGreaterThan(0);
});

test('late remote responses cannot replace the current animal or baby-only asset', async () => {
  let finish!: (url: string) => void;
  mockRemote.mockImplementationOnce(() => new Promise(resolve => {finish = resolve;}));
  await act(async () => {renderer = create(<CharacterView type="duck" stage="baby" />);});
  await act(async () => {renderer.update(<CharacterView type="rabbit" stage="baby" />);});
  await act(async () => finish('https://example.test/duck.riv'));
  expect(renderer.root.findByType(RiveCharacter).props.source).toBe(42);
  await act(async () => {renderer.update(<CharacterView type="rabbit" stage="child" />);});
  expect(renderer.root.findAllByType(RiveCharacter)).toHaveLength(0);
});

test('a different artboard can render after the previous artboard failed', async () => {
  mockRemote.mockResolvedValue('https://example.test/rabbit.riv');
  await act(async () => {renderer = create(<CharacterView type="rabbit" stage="child" />);});
  await act(async () => renderer.root.findByType(RiveCharacter).props.onError());
  await act(async () => {renderer.update(<CharacterView type="rabbit" stage="runner" />);});
  expect(renderer.root.findByType(RiveCharacter).props.stage).toBe('runner');
});

test('complete remote Rive assets keep their own stone animation', async () => {
  mockRemote.mockResolvedValue('https://example.test/duck.riv');
  await act(async () => {renderer = create(<CharacterView type="duck" stage="baby" motion="stone" />);});
  expect(renderer.root.findByType(RiveCharacter).props.motion).toBe('stone');
});

test('an unapproved preview source requires explicit development-only opt-in', async () => {
  await act(async () => {renderer = create(<CharacterView type="rabbit" stage="baby" />);});
  expect(renderer.root.findByType(RiveCharacter).props.source).toBe(42);
  await act(async () => {renderer.update(<CharacterView type="rabbit" stage="baby" previewRiveSource={88} />);});
  expect(renderer.root.findByType(RiveCharacter).props.source).toBe(88);
  const env = globalThis as unknown as {__DEV__: boolean};
  const flag = jest.replaceProperty(env, '__DEV__', false);
  try {
    await act(async () => {renderer.update(<CharacterView type="rabbit" stage="baby" previewRiveSource={88} motion="run" />);});
    expect(renderer.root.findByType(RiveCharacter).props.source).toBe(42);
  } finally {
    flag.restore();
  }
});
