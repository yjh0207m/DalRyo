import React from 'react';
import { Alert, StyleSheet, Text, View as MockView } from 'react-native';
import Renderer, { act } from 'react-test-renderer';
import { LobbyCharacter } from '../src/components/character/LobbyCharacter';
import { HomeScreen } from '../src/screens/home/HomeScreen';
import type { CharacterDocument } from '../src/types/character.types';
import type { UserDocument } from '../src/types/user.types';

const mockRuns = jest.fn();
let mockRunStatus = 'success';
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
    status: mockRunStatus,
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

describe('shortcuts under the character card', () => {
  const shortcut = (label: string) =>
    tree.root.findAll(
      node =>
        typeof node.props.onPress === 'function' &&
        String(node.props.accessibilityLabel ?? '').startsWith(label),
    )[0];
  const renderHome = async (
    props: Partial<React.ComponentProps<typeof HomeScreen>> = {},
  ) => {
    await act(async () => {
      tree.update(
        <HomeScreen
          user={user}
          character={character}
          onNotificationPress={jest.fn()}
          onSettingsPress={jest.fn()}
          {...props}
        />,
      );
    });
  };

  test('three flat shortcuts sit in one row, in the order items, my room, quest', () => {
    const labels = ['아이템', '마이룸', '퀘스트'];
    const tiles = labels.map(shortcut);
    tiles.forEach(tile => expect(tile).toBeDefined());
    tiles.forEach(tile =>
      expect(
        StyleSheet.flatten(tile.props.style({ pressed: false })),
      ).toMatchObject({ flex: 1, minHeight: 76 }),
    );
    // 같은 가로 줄에 있다
    const rowOf = (tile: Renderer.ReactTestInstance) => {
      let node: Renderer.ReactTestInstance | null = tile.parent;
      while (
        node &&
        StyleSheet.flatten(node.props.style)?.flexDirection !== 'row'
      )
        node = node.parent;
      return node;
    };
    expect(rowOf(tiles[0])).toBe(rowOf(tiles[1]));
    expect(rowOf(tiles[1])).toBe(rowOf(tiles[2]));
    const order = rowOf(tiles[0])!
      .findAllByType(Text)
      .map(node => joined(node.props.children))
      .filter(text => labels.includes(text));
    expect(order).toEqual(labels);
  });

  test('they come right after the character card and before today’s run', () => {
    const all = texts();
    expect(all.indexOf('RUNNING MATE')).toBeLessThan(all.indexOf('아이템'));
    expect(all.indexOf('퀘스트')).toBeLessThan(all.indexOf('오늘의 러닝'));
  });

  test('the items square opens the items screen', async () => {
    const onItemsPress = jest.fn();
    await renderHome({ onItemsPress });
    // 연결된 아이템에는 '준비 중' 표시가 없고, 마이룸·퀘스트에만 남는다
    expect(shortcut('아이템').props.accessibilityLabel).toBe('아이템');
    await act(async () => shortcut('아이템').props.onPress());
    expect(onItemsPress).toHaveBeenCalledTimes(1);
  });

  test('my room and quest are marked as not ready and only show a notice when pressed', async () => {
    const alert = jest
      .spyOn(Alert, 'alert')
      .mockImplementation(() => undefined);
    try {
      expect(texts().filter(text => text === '준비 중')).toHaveLength(3);
      await renderHome({ onItemsPress: jest.fn() });
      expect(texts().filter(text => text === '준비 중')).toHaveLength(2);
      await act(async () => shortcut('마이룸').props.onPress());
      expect(alert).toHaveBeenLastCalledWith(
        '마이룸',
        expect.stringContaining('준비 중'),
      );
      await act(async () => shortcut('퀘스트').props.onPress());
      expect(alert).toHaveBeenLastCalledWith(
        '퀘스트',
        expect.stringContaining('준비 중'),
      );
    } finally {
      alert.mockRestore();
    }
  });

  test('without a character there is nothing to open, so the squares are hidden', async () => {
    await renderHome({ character: null });
    expect(shortcut('아이템')).toBeUndefined();
  });
});

describe('telling the app that home has finished drawing', () => {
  const onReady = jest.fn();
  const draw = (
    props: Partial<React.ComponentProps<typeof HomeScreen>> = {},
  ) => (
    <HomeScreen
      user={user}
      character={character}
      onNotificationPress={jest.fn()}
      onSettingsPress={jest.fn()}
      onReady={onReady}
      {...props}
    />
  );
  const characterDrawn = () =>
    act(async () => tree.root.findByType(LobbyCharacter).props.onReady());
  beforeEach(async () => {
    onReady.mockClear();
    mockRunStatus = 'loading';
    await act(async () => tree.update(draw()));
  });
  afterEach(() => {
    mockRunStatus = 'success';
  });

  test('waits for both the character and this week’s records, in either order', async () => {
    expect(onReady).not.toHaveBeenCalled();
    await characterDrawn();
    expect(onReady).not.toHaveBeenCalled();
    mockRunStatus = 'success';
    await act(async () => tree.update(draw()));
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  test('records first, then the character', async () => {
    mockRunStatus = 'success';
    await act(async () => tree.update(draw()));
    expect(onReady).not.toHaveBeenCalled();
    await characterDrawn();
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  test('records that failed to load still count, since the screen shows its own retry', async () => {
    await characterDrawn();
    mockRunStatus = 'error';
    await act(async () => tree.update(draw()));
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  test('without a character there is only the records to wait for', async () => {
    await act(async () => tree.update(draw({ character: null })));
    expect(onReady).not.toHaveBeenCalled();
    mockRunStatus = 'success';
    await act(async () => tree.update(draw({ character: null })));
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  test('announces it only once', async () => {
    mockRunStatus = 'success';
    await act(async () => tree.update(draw()));
    await characterDrawn();
    await act(async () => tree.update(draw()));
    expect(onReady).toHaveBeenCalledTimes(1);
  });
});
