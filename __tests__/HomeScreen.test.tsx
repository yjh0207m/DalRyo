import React from 'react';
import { StyleSheet, Text, View as MockView } from 'react-native';
import Renderer, { act } from 'react-test-renderer';
import { HomeScreen } from '../src/screens/home/HomeScreen';
import type { CharacterDocument } from '../src/types/character.types';
import type { UserDocument } from '../src/types/user.types';

const mockRuns = jest.fn();
jest.mock(
  'lucide-react-native',
  () => new Proxy({}, { get: () => () => null }),
);
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: require('react-native').View,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../src/locales/DialectProvider', () => ({
  useDialect: () => (key: string) => key,
}));
jest.mock('../src/components/character/LobbyCharacter', () => ({
  LobbyCharacter: () => null,
}));
jest.mock('../src/components/scene/CompanionScene', () => ({
  CompanionScene: ({ children }: { children: React.ReactNode }) => (
    <MockView>{children}</MockView>
  ),
}));
jest.mock('../src/components/game/Hud', () => ({
  ExpBar: () => null,
  StreakChip: () => null,
}));
jest.mock('../src/navigation/BottomTabBar', () => ({ TAB_BAR_HEIGHT: 60 }));
jest.mock('../src/hooks/useRunRecords', () => ({
  useRunRecords: () => ({
    runs: mockRuns(),
    status: 'success',
    retry: jest.fn(),
  }),
}));
jest.mock('../src/services/run.service', () => ({
  fetchThisWeekRuns: jest.fn(),
  getRunStartedAtDate: (run: { date: Date }) => run.date,
}));

const character = {
  character_type: 'rabbit',
  stage: 'baby',
  pet_name: '달료',
  equipped: {},
} as unknown as CharacterDocument;
const user = {
  display_name: '유조현',
  total_km: 12.5,
  is_frozen: false,
  last_run_at: null,
} as unknown as UserDocument;
let tree: Renderer.ReactTestRenderer;
const joined = (children: unknown) =>
  ([] as unknown[]).concat(children).join('');
const texts = () =>
  tree.root.findAllByType(Text).map(node => joined(node.props.children));

beforeEach(async () => {
  // 2026-11-04는 수요일이고, 이 주의 월요일은 11-02
  jest.useFakeTimers({ now: new Date('2026-11-04T10:00:00') });
  mockRuns.mockReturnValue([
    {
      date: new Date('2026-11-02T07:00:00'),
      distance_km: 3,
      duration_sec: 900,
      calories: 150,
    },
    {
      date: new Date('2026-11-04T07:00:00'),
      distance_km: 5,
      duration_sec: 1500,
      calories: 300,
    },
  ]);
  await act(async () => {
    tree = Renderer.create(
      <HomeScreen
        user={user}
        character={character}
        onNotificationPress={jest.fn()}
        onSettingsPress={jest.fn()}
      />,
    );
  });
});
afterEach(async () => {
  await act(async () => tree.unmount());
  jest.useRealTimers();
});

test('the greeting block is gone: no headline and no subtitle with the name', () => {
  const all = texts().join('|');
  expect(all).not.toContain('오늘도, 한 걸음 더.');
  expect(all).not.toContain('나만의 속도로 함께 달려요');
  expect(all).not.toContain('유조현');
});

test('the running mate card shows the name and level without a speech line', () => {
  const all = texts();
  expect(all).toContain('RUNNING MATE');
  expect(all).toContain('달료');
  expect(all.some(text => text.startsWith('home.'))).toBe(false);
});

test('the running mate card has no separate section header above it', () => {
  expect(texts()).not.toContain('나의 러닝메이트');
});

test('one line shows the current total on the left and the distance to the next stage on the right', () => {
  const label = tree.root
    .findAllByType(Text)
    .find(node => /까지 .*km$/.test(joined(node.props.children)))!;
  expect(label).toBeDefined();
  // 텍스트 컴포넌트에서 위로 올라가 가로로 배치된 줄을 찾는다
  let row: Renderer.ReactTestInstance | null = label.parent;
  while (row && StyleSheet.flatten(row.props.style)?.flexDirection !== 'row')
    row = row.parent;
  expect(row).not.toBeNull();
  const rowTexts = row!
    .findAllByType(Text)
    .map(node => joined(node.props.children));
  expect(rowTexts).toHaveLength(2);
  expect(rowTexts[0]).toBe('현재 12.5km');
  expect(rowTexts[1]).toMatch(/까지 .*km$/);
  // 오른쪽 문구가 줄의 오른쪽 끝에 붙는다
  expect(StyleSheet.flatten(label.parent!.props.style)).toMatchObject({
    textAlign: 'right',
  });
  // 총 거리는 이 줄에만 한 번 나온다
  expect(texts().filter(text => text.includes('12.5'))).toHaveLength(1);
});

test('the weekly footprint counts days out of the 7 days of the week', () => {
  expect(texts()).toContain('이번 주의 발자국');
  expect(texts()).toContain('2 / 7일');
  expect(texts().join('|')).not.toContain('/ 5일');
});

test('seven days are always the ceiling, even if every day has a run', async () => {
  mockRuns.mockReturnValue(
    Array.from({ length: 3 }, (_, i) => ({
      date: new Date(2026, 10, 2 + i, 7),
      distance_km: 2,
      duration_sec: 600,
      calories: 100,
    })),
  );
  await act(async () => {
    tree.update(
      <HomeScreen
        user={user}
        character={character}
        onNotificationPress={jest.fn()}
        onSettingsPress={jest.fn()}
      />,
    );
  });
  expect(texts()).toContain('3 / 7일');
});
