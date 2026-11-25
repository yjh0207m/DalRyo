import React from 'react';
import { StyleSheet, Text, View as MockView } from 'react-native';
import Renderer, { act } from 'react-test-renderer';
import { RunDetailScreen } from '../src/screens/run/RunDetailScreen';
import type { RunDocument } from '../src/types/run.types';
import { colors, summaryNumber } from '../src/theme';

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

test('the distance, time, pace, calories, EXP and speed sit on a full-width summary band like the monthly total', () => {
  const band = tree.root.find(
    node =>
      typeof node.type === 'string' && node.props.testID === 'run-detail-stats',
  );
  const style = StyleSheet.flatten(band.props.style);
  expect(style.backgroundColor).toBe(colors.secondarySoft);
  // 본문 좌우 여백을 넘어 화면 양끝까지 닿고, 안쪽 글자는 본문 선에 맞춘다
  expect(style.marginHorizontal).toBe(-20);
  expect(style.paddingHorizontal).toBe(20);
  const all = band
    .findAllByType(Text)
    .map(node => ([] as unknown[]).concat(node.props.children).join(''));
  expect(all).toEqual(
    expect.arrayContaining([
      '시간',
      '평균 페이스',
      '칼로리',
      '평균 속도 12.0 km/h',
    ]),
  );
});

test('the distance is the same tall number as the monthly total on the records tab', () => {
  const band = tree.root.find(
    node =>
      typeof node.type === 'string' && node.props.testID === 'run-detail-stats',
  );
  const number = band
    .findAllByType(Text)
    .map(node => StyleSheet.flatten(node.props.style))
    .find(style => style.transform);
  expect(number?.transform).toEqual([{ scaleY: summaryNumber.stretch }]);
  expect(number?.fontSize).toBe(summaryNumber.fontSize);
  expect(number?.lineHeight).toBe(summaryNumber.lineHeight);
});
