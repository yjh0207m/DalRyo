import React from 'react';
import { View as MockView } from 'react-native';
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
