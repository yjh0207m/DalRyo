import React from 'react';
import { Text, View as MockView } from 'react-native';
import Renderer, { act } from 'react-test-renderer';
import { RunDetailScreen } from '../src/screens/run/RunDetailScreen';
import type { RunDocument } from '../src/types/run.types';

const mockShare = jest.fn();
jest.mock(
  'lucide-react-native',
  () => new Proxy({}, { get: () => () => null }),
);
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: require('react-native').View,
}));
jest.mock('../src/components/maps/RouteMap', () => ({ RouteMap: () => null }));
jest.mock('../src/services/park.service', () => ({
  fetchParkLabel: jest.fn(),
}));
jest.mock('../src/services/run.service', () => ({
  getRunStartedAtDate: () => new Date('2026-10-31T09:00:00'),
}));
jest.mock('../src/screens/run/ShareStudioScreen', () => ({
  ShareStudioScreen: (props: { onPosted?: () => void }) => {
    mockShare(props);
    return <MockView testID="share" />;
  },
}));

const run = {
  run_id: 'run-1',
  distance_km: 5,
  duration_sec: 1500,
  avg_pace_sec: 300,
  avg_speed_kmh: 12,
  calories: 300,
  exp_earned: 20,
  started_at: { toDate: () => new Date('2026-10-31T09:00:00') },
  park_id: null,
  route: [],
} as unknown as RunDocument;

let tree: Renderer.ReactTestRenderer;
beforeEach(async () => {
  jest.clearAllMocks();
  await act(async () => {
    tree = Renderer.create(
      <RunDetailScreen run={run} character={null} onBack={jest.fn()} />,
    );
  });
});
afterEach(async () => {
  await act(async () => tree.unmount());
});
const texts = () =>
  tree.root.findAllByType(Text).map(node => node.props.children);
const buttons = () =>
  tree.root.findAll(
    node =>
      typeof node.props.onPress === 'function' &&
      node.props.accessibilityRole === 'button',
  );

test('the top right share button is gone: only the back button remains in the header', () => {
  expect(
    buttons()
      .map(node => node.props.accessibilityLabel)
      .filter(Boolean),
  ).toEqual(['기록 상세에서 뒤로']);
  expect(
    buttons().some(node => node.props.accessibilityLabel === '기록 공유'),
  ).toBe(false);
});

test('the route heading has no ROUTE caption', () => {
  expect(texts()).toContain('내가 달린 길');
  expect(texts()).not.toContain('ROUTE');
});

test('the card button is labelled 오운완 카드 and opens the card screen', async () => {
  expect(texts()).not.toContain('사진·캐릭터와 기록 공유');
  const text = tree.root
    .findAllByType(Text)
    .find(node => node.props.children === '오운완 카드')!;
  let node: Renderer.ReactTestInstance | null = text;
  while (node && typeof node.props.onPress !== 'function') node = node.parent;
  await act(async () => node!.props.onPress());
  expect(tree.root.findAllByProps({ testID: 'share' }).length).toBeGreaterThan(
    0,
  );
});

test('the average speed is labelled as speed, with the km/h value', () => {
  const joined = (children: unknown) =>
    ([] as unknown[]).concat(children).join('');
  const all = tree.root
    .findAllByType(Text)
    .map(node => joined(node.props.children));
  expect(all).toContain('평균 속도 12.0 km/h');
  expect(all).not.toContain('평균 12.0 km/h');
});
