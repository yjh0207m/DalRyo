import React from 'react';
import { StyleSheet, Text, View as MockView } from 'react-native';
import Renderer, { act } from 'react-test-renderer';
import { RecordScreen } from '../src/screens/run/RecordScreen';
import type { RunDocument } from '../src/types/run.types';
const mockDetail = jest.fn();
const now = new Date();
const mockRuns = [1, 2].map(day => ({
  run_id: `run-${day}`,
  goal_type: 'free',
  distance_km: day,
  duration_sec: day * 600,
  avg_pace_sec: 600,
  calories: day * 60,
  route: [],
  started_at: {
    toDate: () => new Date(now.getFullYear(), now.getMonth(), day),
  },
})) as unknown as RunDocument[];
jest.mock('../src/hooks/useRunRecords', () => ({
  useRunRecords: () => ({
    runs: mockRuns,
    status: 'success',
    retry: jest.fn(),
  }),
}));
jest.mock('../src/services/run.service', () => ({
  fetchMonthlyRuns: jest.fn(),
  getRunStartedAtDate: (run: RunDocument) =>
    (run.started_at as { toDate: () => Date }).toDate(),
}));
jest.mock('../src/screens/run/RunDetailScreen', () => ({
  RunDetailScreen: (props: unknown) => {
    mockDetail(props);
    return <MockView />;
  },
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: MockView,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
}));
jest.mock(
  'lucide-react-native',
  () => new Proxy({}, { get: () => () => null }),
);
let tree: Renderer.ReactTestRenderer;
afterEach(async () => {
  await act(() => tree?.unmount());
});
async function render() {
  await act(async () => {
    tree = Renderer.create(
      <RecordScreen
        onNotificationPress={jest.fn()}
        onSettingsPress={jest.fn()}
      />,
    );
  });
}
function entries() {
  return tree.root
    .findAll(
      node =>
        typeof node.props.onPress === 'function' &&
        typeof node.type === 'function' &&
        node.type.name === 'Pressable',
    )
    .filter(node => /km 기록 보기$/.test(node.props.accessibilityLabel ?? ''));
}
test('the journal opens the selected saved record directly', async () => {
  await render();
  expect(entries()).toHaveLength(2);
  await act(() => entries()[0].props.onPress());
  expect(mockDetail.mock.calls.at(-1)?.[0].run.run_id).toBe('run-1');
});
test('calendar selection filters the list and returning to journal clears the filter', async () => {
  await render();
  const tab = () =>
    tree.root
      .findAll(
        node =>
          typeof node.props.onPress === 'function' &&
          typeof node.type === 'function' &&
          node.type.name === 'Pressable',
      )
      .filter(node => node.props.accessibilityRole === 'tab');
  await act(() => tab()[1].props.onPress());
  const day = tree.root
    .findAll(
      node =>
        typeof node.props.onPress === 'function' &&
        typeof node.type === 'function' &&
        node.type.name === 'Pressable',
    )
    .find(node =>
      (node.props.accessibilityLabel ?? '').startsWith(
        `${now.getMonth() + 1}월 1일`,
      ),
    )!;
  await act(() => day.props.onPress());
  expect(entries()).toHaveLength(1);
  await act(() => tab()[0].props.onPress());
  expect(entries()).toHaveLength(2);
});
test('the record screen has no tagline under the header', async () => {
  await render();
  const all = tree.root
    .findAllByType(Text)
    .map(node => ([] as unknown[]).concat(node.props.children).join(''));
  expect(all.join('|')).not.toContain('차곡차곡');
});

test('the month selector sits right under the header with no leftover tagline spacing', async () => {
  await render();
  const prev = tree.root.find(
    node =>
      node.props.accessibilityLabel === '이전 달' &&
      typeof node.props.onPress === 'function' &&
      typeof node.props.style === 'function',
  );
  expect(
    StyleSheet.flatten(prev.props.style({ pressed: false })),
  ).toMatchObject({ width: 40, height: 40 });
  let row: Renderer.ReactTestInstance | null = prev.parent;
  while (
    row &&
    StyleSheet.flatten(row.props.style)?.justifyContent !== 'space-between'
  )
    row = row.parent;
  expect(row).not.toBeNull();
  expect(StyleSheet.flatten(row!.props.style).marginTop).toBe(0);
});
test('the record detail slides in over the list instead of replacing it, and going back closes only the detail', async () => {
  await render();
  const listHidden = () =>
    tree.root.findAll(node => node.props.accessibilityElementsHidden === true)
      .length > 0;
  expect(listHidden()).toBe(false);
  await act(() => entries()[0].props.onPress());
  expect(mockDetail).toHaveBeenCalled();
  // 목록은 지워지지 않고 아래에 그대로 있으며, 화면 읽기 기능에서는 가려진다
  expect(entries()).toHaveLength(2);
  expect(listHidden()).toBe(true);
  await act(async () => mockDetail.mock.calls.at(-1)?.[0].onBack());
  expect(entries()).toHaveLength(2);
  expect(listHidden()).toBe(false);
  const before = mockDetail.mock.calls.length;
  await act(async () => {});
  expect(mockDetail.mock.calls.length).toBe(before);
});
