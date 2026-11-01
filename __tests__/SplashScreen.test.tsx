import React from 'react';
import {ActivityIndicator, ImageBackground, Text} from 'react-native';
import Renderer, {act} from 'react-test-renderer';
import {AuthStartScreen} from '../src/screens/auth/SplashScreen';

const mockDusk = jest.fn();
jest.mock('../src/utils/skyBackground', () => ({
  getIsDuskSync: () => mockDusk(),
  getIsDusk: () => Promise.resolve(mockDusk()),
}));

let tree: Renderer.ReactTestRenderer;
async function render(props: {onStart?: () => void; loading?: boolean}) {
  await act(async () => {
    tree = Renderer.create(<AuthStartScreen onStart={props.onStart ?? jest.fn()} loading={props.loading} />);
  });
}
const texts = () => tree.root.findAllByType(Text).map(node => node.props.children);
afterEach(async () => {
  await act(async () => tree.unmount());
});

test('shows the start button and calls onStart when not loading', async () => {
  mockDusk.mockReturnValue(false);
  const onStart = jest.fn();
  await render({onStart});
  const button = tree.root.findAll(node => typeof node.props.onPress === 'function')[0];
  expect(texts()).toContain('시작하기');
  await act(async () => button.props.onPress());
  expect(onStart).toHaveBeenCalledTimes(1);
});

test('keeps the same background and greeting while loading, but swaps the button for a spinner', async () => {
  mockDusk.mockReturnValue(false);
  await render({loading: true});
  expect(texts()).not.toContain('시작하기');
  expect(texts()).toContain('달료');
  expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(1);
  expect(tree.root.findAll(node => typeof node.props.onPress === 'function')).toHaveLength(0);
});

test('uses the daytime image by day and the dusk image at dusk, in loading too', async () => {
  mockDusk.mockReturnValue(false);
  await render({loading: true});
  const day = tree.root.findByType(ImageBackground).props.source;
  await act(async () => tree.unmount());
  mockDusk.mockReturnValue(true);
  await render({loading: true});
  const dusk = tree.root.findByType(ImageBackground).props.source;
  expect(day).not.toBe(dusk);
  expect(texts()).toContain('오늘도 수고했어요!');
});
