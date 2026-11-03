import React, { useEffect, useState } from 'react';
import { PanResponder, Pressable, Text, View } from 'react-native';
import Renderer, { act } from 'react-test-renderer';
import { MainAppScreen } from '../src/screens/main/MainAppScreen';
import type { CharacterDocument } from '../src/types/character.types';
import type { UserDocument } from '../src/types/user.types';

type HeaderProps = {
  onSettingsPress: () => void;
  onNotificationPress?: () => void;
  onItemsPress?: () => void;
  initialRoute?: unknown;
  onInitialRouteHandled?: () => void;
  onSubpageChange?: (open: boolean) => void;
  onReady?: () => void;
};
// 화면들은 이동에 쓰는 버튼만 그려 주는 가짜로 바꾼다
function fakeTab(name: string) {
  return (props: HeaderProps) => {
    // 진짜 커뮤니티 화면처럼 시작 경로를 첫 렌더에만 읽고 기억한 뒤 부모에게 알린다
    const [opened] = useState(props.initialRoute);
    useEffect(() => {
      props.onInitialRouteHandled?.();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
      <View>
        <Text>{`${name} 화면`}</Text>
        {!!opened && (
          <Text>{`${name} 화면 열린 경로 ${JSON.stringify(opened)}`}</Text>
        )}
        <Pressable
          accessibilityLabel={`${name} 하위 화면 열기`}
          onPress={() => props.onSubpageChange?.(true)}
        />
        <Pressable
          accessibilityLabel={`${name} 하위 화면 닫기`}
          onPress={() => props.onSubpageChange?.(false)}
        />
        <Pressable
          accessibilityLabel={`${name} 준비 끝`}
          onPress={props.onReady}
        />
        <Pressable
          accessibilityLabel={`${name} 알림`}
          onPress={props.onNotificationPress}
        />
        <Pressable
          accessibilityLabel={`${name} 설정`}
          onPress={props.onSettingsPress}
        />
        {props.onItemsPress && (
          <Pressable
            accessibilityLabel="아이템 바로가기"
            onPress={props.onItemsPress}
          />
        )}
      </View>
    );
  };
}
jest.mock(
  'lucide-react-native',
  () => new Proxy({}, { get: () => () => null }),
);
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: require('react-native').View,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../src/screens/home/HomeScreen', () => ({
  HomeScreen: (props: HeaderProps) =>
    require('react').createElement(mockTabs['홈'], props),
}));
jest.mock('../src/screens/growth/GrowthScreen', () => ({
  GrowthScreen: (props: HeaderProps) =>
    require('react').createElement(mockTabs['성장'], props),
}));
jest.mock('../src/screens/community/CommunityScreen', () => ({
  CommunityScreen: (props: HeaderProps) =>
    require('react').createElement(mockTabs['커뮤니티'], props),
}));
jest.mock('../src/screens/run/RecordScreen', () => ({
  RecordScreen: (props: HeaderProps) =>
    require('react').createElement(mockTabs['기록'], props),
}));
// 렌더링마다 새로 만들면 다시 마운트되므로 탭마다 한 번만 만든다
const mockTabs: Record<string, ReturnType<typeof fakeTab>> = {
  홈: fakeTab('홈'),
  성장: fakeTab('성장'),
  커뮤니티: fakeTab('커뮤니티'),
  기록: fakeTab('기록'),
};
const mockSettings = jest.fn();
const mockInventory = jest.fn();
jest.mock('../src/screens/profile/SettingsScreen', () => ({
  SettingsScreen: (props: {
    onBack: () => void;
    onPreviewCharacter?: () => void;
    onOpenSaved?: () => void;
    onOpenBlocked?: () => void;
  }) => {
    const R = require('react');
    const N = require('react-native');
    mockSettings(props);
    return R.createElement(
      N.View,
      null,
      R.createElement(N.Text, null, '설정 화면'),
      R.createElement(N.Pressable, {
        accessibilityLabel: '설정 뒤로',
        onPress: props.onBack,
      }),
      R.createElement(N.Pressable, {
        accessibilityLabel: '캐릭터 미리보기',
        onPress: props.onPreviewCharacter,
      }),
      R.createElement(N.Pressable, {
        accessibilityLabel: '저장한 게시물',
        onPress: props.onOpenSaved,
      }),
      R.createElement(N.Pressable, {
        accessibilityLabel: '차단한 사용자',
        onPress: props.onOpenBlocked,
      }),
    );
  },
}));
jest.mock('../src/screens/profile/BlockedUsersScreen', () => ({
  BlockedUsersScreen: () => {
    const R = require('react');
    const N = require('react-native');
    return R.createElement(N.Text, null, '차단 목록 화면');
  },
}));
jest.mock('../src/screens/profile/InventoryScreen', () => ({
  InventoryScreen: (props: { initialMode: string; onBack: () => void }) => {
    const R = require('react');
    const N = require('react-native');
    mockInventory(props);
    return R.createElement(
      N.View,
      null,
      R.createElement(N.Text, null, `보관함 ${props.initialMode}`),
      R.createElement(N.Pressable, {
        accessibilityLabel: '보관함 뒤로',
        onPress: props.onBack,
      }),
    );
  },
}));
jest.mock('../src/screens/dev/CharacterPreviewScreen', () => ({
  CharacterPreviewScreen: () =>
    require('react').createElement(
      require('react-native').Text,
      null,
      '캐릭터 미리보기 화면',
    ),
}));
jest.mock('../src/screens/together/TogetherScreen', () => ({
  TogetherScreen: () =>
    require('react').createElement(
      require('react-native').Text,
      null,
      '같이 달리기 화면',
    ),
}));
jest.mock('../src/screens/parks/ParksScreen', () => ({
  ParksScreen: () => null,
}));
jest.mock('../src/screens/profile/NotificationsScreen', () => ({
  NotificationsScreen: (props: { onNavigate: (target: unknown) => void }) => {
    const R = require('react');
    const N = require('react-native');
    const targets: Array<[string, unknown]> = [
      ['post', { kind: 'post', postId: 'post-9' }],
      ['profile', { kind: 'profile', uid: 'u-minji' }],
      ['together', { kind: 'together' }],
      ['growth', { kind: 'growth' }],
      ['home', { kind: 'home' }],
      ['settings', { kind: 'settings' }],
    ];
    return R.createElement(
      N.View,
      null,
      R.createElement(N.Text, null, '알림 화면'),
      ...targets.map(([name, target]) =>
        R.createElement(N.Pressable, {
          key: name,
          accessibilityLabel: `알림 이동 ${name}`,
          onPress: () => props.onNavigate(target),
        }),
      ),
    );
  },
}));
jest.mock('../src/screens/run/GoalValueScreen', () => ({
  GoalValueScreen: () => null,
}));
jest.mock('../src/screens/run/CompletedRunScreen', () => ({
  CompletedRunScreen: () => null,
}));
jest.mock('../src/screens/run/RunningScreen', () => ({
  RunningScreen: () => null,
}));
jest.mock('../src/screens/run/RunStartSheet', () => ({
  RunStartSheet: () => null,
}));
jest.mock('../src/screens/run/RunRecoveryScreen', () => ({
  RunRecoveryScreen: () => null,
}));
jest.mock('../src/hooks/useNotifications', () => ({
  useUnreadNotifications: () => false,
}));
jest.mock('../src/hooks/usePushNotifications', () => ({
  usePushNotifications: () => ({ notice: null, dismiss: jest.fn() }),
}));
jest.mock('../src/hooks/useRunRecovery', () => ({
  useRunRecovery: () => ({
    status: 'ready',
    active: null,
    pending: 0,
    syncing: false,
    dismiss: jest.fn(),
    refresh: jest.fn(),
    sync: jest.fn(),
  }),
}));
jest.mock('../src/services/runOutbox.service', () => ({
  queueRun: jest.fn(),
  uploadPendingRun: jest.fn(),
}));
jest.mock('../src/services/room.service', () => ({
  publishRoomProgress: jest.fn(),
}));

const user = {
  uid: 'u1',
  total_km: 12.5,
  is_frozen: false,
  weight_kg: 60,
} as unknown as UserDocument;
const character = {
  uid: 'u1',
  character_type: 'rabbit',
  stage: 'baby',
} as unknown as CharacterDocument;
let tree: Renderer.ReactTestRenderer;
async function render(props: { user?: UserDocument | null } = {}) {
  await act(async () => {
    tree = Renderer.create(
      <MainAppScreen
        user={props.user === undefined ? user : props.user}
        character={character}
      />,
    );
  });
}
const texts = () =>
  tree.root
    .findAllByType(Text)
    .map(node => [].concat(node.props.children as never).join(''));
const press = (label: string) =>
  act(async () => {
    tree.root
      .find(
        node =>
          node.props.accessibilityLabel === label &&
          typeof node.props.onPress === 'function',
      )
      .props.onPress();
  });
// 하단 탭은 접근성 라벨 없이 글자만 있어서, 탭 역할의 항목 중 해당 글자를 가진 것을 누른다
const pressTab = (label: string) =>
  act(async () => {
    tree.root
      .findAll(
        node =>
          node.props.accessibilityRole === 'tab' &&
          typeof node.props.onPress === 'function' &&
          node.findAllByType(Text).some(text => text.props.children === label),
      )[0]
      .props.onPress();
  });
const tabLabels = () =>
  tree.root
    .findAll(node => node.props.accessibilityRole === 'tab')
    .flatMap(node => node.findAllByType(Text).map(text => text.props.children));
const has = (label: string) =>
  tree.root.findAll(
    node =>
      node.props.accessibilityLabel === label &&
      typeof node.props.onPress === 'function',
  ).length > 0;

beforeEach(() => jest.clearAllMocks());
afterEach(async () => {
  await act(async () => tree.unmount());
});

const underlayHidden = () =>
  tree.root.findAll(node => node.props.accessibilityElementsHidden === true)
    .length > 0;

test('the settings icon opens settings directly on top of the tab, and back returns to the tab it was pressed on', async () => {
  await render();
  expect(texts()).toContain('홈 화면');
  expect(underlayHidden()).toBe(false);
  await press('홈 설정');
  expect(texts()).toContain('설정 화면');
  // 탭 화면은 지워지지 않고 아래에 그대로 있으며, 화면 읽기 기능에서는 가려진다
  expect(texts()).toContain('홈 화면');
  expect(underlayHidden()).toBe(true);
  await press('설정 뒤로');
  expect(texts()).toContain('홈 화면');
  expect(texts()).not.toContain('설정 화면');
  expect(underlayHidden()).toBe(false);
});

test('every tab header opens the same settings and returns to its own tab', async () => {
  await render();
  await pressTab('성장');
  expect(texts()).toContain('성장 화면');
  await press('성장 설정');
  expect(texts()).toContain('설정 화면');
  await press('설정 뒤로');
  expect(texts()).toContain('성장 화면');
  await pressTab('기록');
  await press('기록 설정');
  await press('설정 뒤로');
  expect(texts()).toContain('기록 화면');
});

test('there is no My page tab any more', async () => {
  await render();
  expect(new Set(tabLabels())).toEqual(
    new Set(['홈', '성장', '커뮤니티', '기록']),
  );
  expect(texts().join('|')).not.toContain('마이');
  expect(has('마이')).toBe(false);
  await press('홈 설정');
  expect(texts()).not.toContain('마이');
});

test('settings do not open without an account', async () => {
  await render({ user: null });
  await press('홈 설정');
  expect(texts()).toContain('홈 화면');
  expect(texts()).not.toContain('설정 화면');
});

test('the home items shortcut opens the inventory on the owned items and returns home', async () => {
  await render();
  await press('아이템 바로가기');
  expect(texts()).toContain('보관함 owned');
  await press('보관함 뒤로');
  expect(texts()).toContain('홈 화면');
});

test('the development-only character preview is reachable from settings', async () => {
  await render();
  await press('홈 설정');
  await press('캐릭터 미리보기');
  expect(texts()).toContain('캐릭터 미리보기 화면');
});

describe('opening a notification', () => {
  const openNotifications = async () => {
    await press('홈 알림');
    expect(texts()).toContain('알림 화면');
  };

  test('a post notification closes the list and opens that post on top of the community feed', async () => {
    await render();
    await openNotifications();
    await press('알림 이동 post');
    expect(texts()).not.toContain('알림 화면');
    expect(texts()).toContain('커뮤니티 화면');
    expect(texts()).toContain(
      '커뮤니티 화면 열린 경로 {"page":"post","id":"post-9"}',
    );
  });

  test('a follower notification opens that person’s profile', async () => {
    await render();
    await openNotifications();
    await press('알림 이동 profile');
    expect(texts()).toContain(
      '커뮤니티 화면 열린 경로 {"page":"profile","uid":"u-minji"}',
    );
  });

  test('the opened post or profile is used once: coming back to the community tab later shows the plain feed', async () => {
    await render();
    await openNotifications();
    await press('알림 이동 post');
    expect(texts().join('|')).toContain('열린 경로');
    await pressTab('성장');
    await pressTab('커뮤니티');
    expect(texts()).toContain('커뮤니티 화면');
    expect(texts().join('|')).not.toContain('열린 경로');
  });

  test('a notification opens its post even when the community tab was already open', async () => {
    await render();
    await pressTab('커뮤니티');
    expect(texts().join('|')).not.toContain('열린 경로');
    await press('커뮤니티 알림');
    await press('알림 이동 post');
    expect(texts()).toContain(
      '커뮤니티 화면 열린 경로 {"page":"post","id":"post-9"}',
    );
  });

  test('growth, stone and together notifications go to their own places', async () => {
    await render();
    await openNotifications();
    await press('알림 이동 growth');
    expect(texts()).toContain('성장 화면');
    await press('성장 알림');
    await press('알림 이동 together');
    expect(texts()).toContain('같이 달리기 화면');
  });

  test('a stone warning opens the home tab, even when it was opened from another tab', async () => {
    await render();
    await pressTab('성장');
    await press('성장 알림');
    await press('알림 이동 home');
    expect(texts()).toContain('홈 화면');
    expect(texts()).not.toContain('성장 화면');
  });

  test('a settings notification opens settings', async () => {
    await render();
    await openNotifications();
    await press('알림 이동 settings');
    expect(texts()).toContain('설정 화면');
    expect(texts()).not.toContain('알림 화면');
  });
});

describe('swiping between the main tabs', () => {
  type Config = {
    onMoveShouldSetPanResponder: (
      event: unknown,
      gesture: { dx: number; dy: number },
    ) => boolean;
    onPanResponderRelease: (
      event: unknown,
      gesture: { dx: number; dy: number },
    ) => void;
  };
  let config: Config;
  beforeEach(() => {
    const create = PanResponder.create.bind(PanResponder);
    jest.spyOn(PanResponder, 'create').mockImplementation(((given: Config) => {
      config = given;
      return create(given);
    }) as unknown as typeof PanResponder.create);
  });
  afterEach(() => jest.restoreAllMocks());
  const swipe = (dx: number, dy = 0) =>
    act(async () => {
      config.onPanResponderRelease({}, { dx, dy });
    });

  test('right to left goes home → growth → community → records, one tab per swipe', async () => {
    await render();
    expect(texts()).toContain('홈 화면');
    await swipe(-200);
    expect(texts()).toContain('성장 화면');
    await swipe(-200);
    expect(texts()).toContain('커뮤니티 화면');
    await swipe(-200);
    expect(texts()).toContain('기록 화면');
    await swipe(-200);
    expect(texts()).toContain('기록 화면');
  });

  test('left to right goes records → community → growth → home', async () => {
    await render();
    await pressTab('기록');
    expect(texts()).toContain('기록 화면');
    await swipe(200);
    expect(texts()).toContain('커뮤니티 화면');
    await swipe(200);
    expect(texts()).toContain('성장 화면');
    await swipe(200);
    expect(texts()).toContain('홈 화면');
    await swipe(200);
    expect(texts()).toContain('홈 화면');
  });

  test('tapping a tab and swiping stay in step with each other', async () => {
    await render();
    await pressTab('커뮤니티');
    await swipe(200);
    expect(texts()).toContain('성장 화면');
  });

  test('a short or mostly vertical drag does not change the tab', async () => {
    await render();
    await swipe(-30);
    await swipe(-200, 100);
    expect(texts()).toContain('홈 화면');
  });

  test('inside a community or record sub screen the swipe is off, and back on once it closes', async () => {
    await render();
    await pressTab('커뮤니티');
    await press('커뮤니티 하위 화면 열기');
    expect(config.onMoveShouldSetPanResponder({}, { dx: 80, dy: 0 })).toBe(
      false,
    );
    await swipe(-200);
    await swipe(200);
    expect(texts()).toContain('커뮤니티 화면');
    await press('커뮤니티 하위 화면 닫기');
    await swipe(-200);
    expect(texts()).toContain('기록 화면');
    await press('기록 하위 화면 열기');
    await swipe(200);
    expect(texts()).toContain('기록 화면');
  });

  test('while a full screen such as settings is open the swipe is off, and works again after it closes', async () => {
    await render();
    expect(config.onMoveShouldSetPanResponder({}, { dx: 80, dy: 0 })).toBe(
      true,
    );
    await press('홈 설정');
    expect(texts()).toContain('설정 화면');
    expect(config.onMoveShouldSetPanResponder({}, { dx: 80, dy: 0 })).toBe(
      false,
    );
    await swipe(-200);
    await press('설정 뒤로');
    // 설정이 열려 있는 동안의 스와이프로 아래 탭이 바뀌지 않았다
    expect(texts()).toContain('홈 화면');
    expect(texts()).not.toContain('성장 화면');
    expect(config.onMoveShouldSetPanResponder({}, { dx: 80, dy: 0 })).toBe(
      true,
    );
  });
});

test('“저장한 게시물” in settings closes settings and opens the saved posts inside the community', async () => {
  await render();
  await press('홈 설정');
  expect(texts()).toContain('설정 화면');
  await press('저장한 게시물');
  expect(texts()).not.toContain('설정 화면');
  expect(texts()).toContain('커뮤니티 화면');
  expect(texts()).toContain('커뮤니티 화면 열린 경로 {"page":"saved"}');
});

test('“차단한 사용자” in settings opens the blocked list over settings', async () => {
  await render();
  await press('홈 설정');
  await press('차단한 사용자');
  expect(texts()).toContain('차단 목록 화면');
  expect(texts()).not.toContain('설정 화면');
});

test('the app is told when the home screen has finished drawing', async () => {
  const onHomeReady = jest.fn();
  await act(async () => {
    tree = Renderer.create(
      <MainAppScreen
        user={user}
        character={character}
        onHomeReady={onHomeReady}
      />,
    );
  });
  expect(onHomeReady).not.toHaveBeenCalled();
  await press('홈 준비 끝');
  expect(onHomeReady).toHaveBeenCalledTimes(1);
});
