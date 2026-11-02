import React from 'react';
import { Alert, Image, View as MockView } from 'react-native';
import Renderer, { act } from 'react-test-renderer';
import { NotificationsScreen } from '../src/screens/profile/NotificationsScreen';
import {
  resetBackgroundTasks,
  useBackgroundToasts,
  type BackgroundToast,
} from '../src/services/backgroundTask.service';
import type { AppNotification } from '../src/types/notification.types';

const mockMarkRead = jest.fn();
const mockSetRead = jest.fn();
const mockItems = jest.fn();
jest.mock('../src/services/notification.service', () => ({
  markNotificationRead: (...args: unknown[]) => mockMarkRead(...args),
}));
jest.mock('../src/hooks/useNotifications', () => ({
  useNotifications: () => ({
    items: mockItems(),
    status: 'success',
    retry: jest.fn(),
    loadMore: jest.fn(),
    loadingMore: false,
    moreError: false,
    hasMore: false,
    setRead: (...args: unknown[]) => mockSetRead(...args),
  }),
}));
jest.mock('../src/locales/DialectProvider', () => ({
  useDialect: () => (key: string) => key,
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: MockView,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
}));
// 아이콘마다 이름을 붙여 어떤 아이콘이 그려졌는지 확인한다
jest.mock('lucide-react-native', () => {
  const cache: Record<string, () => null> = {};
  return new Proxy(
    {},
    {
      get: (_target, name: string) =>
        (cache[name] ??= Object.assign(() => null, { displayName: name })),
    },
  );
});

const note = (extra: Partial<AppNotification>): AppNotification => ({
  id: 'n1',
  type: 'like',
  is_read: false,
  actor_name: '민지',
  ...extra,
});
let tree: Renderer.ReactTestRenderer;
let probe: Renderer.ReactTestRenderer;
let toasts: BackgroundToast[] = [];
let alert: jest.SpyInstance;
const onNavigate = jest.fn();
function Probe() {
  toasts = useBackgroundToasts();
  return null;
}
async function render(items: AppNotification[], withNavigate = true) {
  mockItems.mockReturnValue(items);
  await act(async () => {
    tree = Renderer.create(
      <NotificationsScreen
        onBack={jest.fn()}
        onNavigate={withNavigate ? onNavigate : undefined}
      />,
    );
  });
}
const rows = () =>
  tree.root.findAll(
    node =>
      typeof node.props.onPress === 'function' &&
      node.props.accessibilityRole === 'button' &&
      /알림,/.test(String(node.props.accessibilityLabel)),
  );
const open = (index = 0) =>
  act(async () => {
    rows()[index].props.onPress();
  });
const icons = (root: Renderer.ReactTestInstance = tree.root) =>
  root
    .findAll(
      node =>
        typeof node.type === 'function' &&
        !!(node.type as unknown as { displayName?: string }).displayName,
    )
    .map(node => (node.type as unknown as { displayName: string }).displayName);
const rowIcons = (index = 0) => icons(rows()[index]);
const photos = (index = 0) => rows()[index].findAllByType(Image);

beforeEach(async () => {
  jest.clearAllMocks();
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  await act(async () => {
    probe = Renderer.create(<Probe />);
  });
});
afterEach(async () => {
  alert.mockRestore();
  await act(async () => {
    resetBackgroundTasks();
    tree.unmount();
    probe.unmount();
  });
});

describe('the circle on the left of each notification', () => {
  test('an interaction from a person shows that person’s profile photo', async () => {
    await render([
      note({ type: 'follow', actor_image: 'https://img.example/minji.jpg' }),
    ]);
    expect(photos()).toHaveLength(1);
    expect(photos()[0].props.source).toEqual({
      uri: 'https://img.example/minji.jpg',
    });
  });

  test('without a photo it shows a person icon instead of an empty circle', async () => {
    await render([
      note({ type: 'like' }),
      note({ id: 'n2', type: 'comment', actor_image: null }),
    ]);
    expect(photos(0)).toHaveLength(0);
    expect(rowIcons(0)).toContain('UserRound');
    expect(rowIcons(1)).toContain('UserRound');
  });

  test('a small badge says what the person did', async () => {
    await render([
      note({ id: 'a', type: 'comment' }),
      note({ id: 'b', type: 'follow' }),
      note({ id: 'c', type: 'room_invite' }),
      note({ id: 'd', type: 'like' }),
    ]);
    expect(rowIcons(0)).toContain('MessageCircle');
    expect(rowIcons(1)).toContain('UserPlus');
    expect(rowIcons(2)).toContain('Footprints');
    // 응원은 앱의 러닝화 아이콘(SVG)이라 lucide 아이콘이 아니다
    expect(rowIcons(3)).not.toContain('MessageCircle');
  });

  test('growth, stone and settings notifications get an icon that fits them, not a person', async () => {
    await render([
      note({ id: 'a', type: 'level_up', actor_name: '달료' }),
      note({ id: 'b', type: 'stone_warning', level: 'stone' }),
      note({ id: 'c', type: 'stone_warning', level: 'warn3' }),
      note({ id: 'd', type: 'settings' }),
      note({ id: 'e', type: 'something_new' }),
    ]);
    expect(rowIcons(0)).toContain('TrendingUp');
    expect(rowIcons(1)).toContain('Mountain');
    expect(rowIcons(2)).toContain('Snowflake');
    expect(rowIcons(3)).toContain('Settings');
    expect(rowIcons(4)).toContain('Bell');
    for (let i = 0; i < 5; i++) {
      expect(photos(i)).toHaveLength(0);
      expect(rowIcons(i)).not.toContain('UserRound');
    }
  });

  test('the circle is decoration only, so screen readers read just the notification text', async () => {
    await render([
      note({ type: 'like', actor_image: 'https://img.example/a.jpg' }),
    ]);
    const hidden = rows()[0].findAll(
      node => node.props.accessibilityElementsHidden === true,
    );
    expect(hidden.length).toBeGreaterThan(0);
  });
});

describe('pressing a notification goes to where it points', () => {
  const cases: Array<[string, Partial<AppNotification>, unknown]> = [
    [
      'an encouragement opens that post',
      { type: 'like', target_id: 'post-9' },
      { kind: 'post', postId: 'post-9' },
    ],
    [
      'a comment opens that post',
      { type: 'comment', target_id: 'post-3' },
      { kind: 'post', postId: 'post-3' },
    ],
    [
      'a new follower opens their profile',
      { type: 'follow', actor_uid: 'u-minji', target_id: 'u-minji' },
      { kind: 'profile', uid: 'u-minji' },
    ],
    [
      'a together-run request opens the together screen',
      { type: 'room_invite', target_id: 'room-1' },
      { kind: 'together' },
    ],
    [
      'growth opens the growth tab',
      { type: 'level_up', stage: 'baby' },
      { kind: 'growth' },
    ],
    [
      'a stone warning opens home',
      { type: 'stone_warning', level: 'warn3' },
      { kind: 'home' },
    ],
    [
      'a settings notification opens settings',
      { type: 'settings' },
      { kind: 'settings' },
    ],
  ];
  test.each(cases)('%s', async (_name, extra, target) => {
    mockMarkRead.mockReturnValue(new Promise(() => {}));
    await render([note(extra)]);
    await open();
    expect(onNavigate).toHaveBeenCalledWith(target);
    expect(alert).not.toHaveBeenCalled();
  });

  test('an unread notification is marked read in the background on the way', async () => {
    mockMarkRead.mockReturnValue(new Promise(() => {}));
    await render([note({ type: 'like', target_id: 'post-9' })]);
    await open();
    expect(mockSetRead).toHaveBeenCalledWith('n1');
    expect(mockMarkRead).toHaveBeenCalledWith('n1');
    expect(toasts).toEqual([]);
  });

  test('if marking it read fails, it still navigates and only a small popup says so', async () => {
    mockMarkRead.mockRejectedValue(new Error('연결 오류'));
    await render([note({ type: 'like', target_id: 'post-9' })]);
    await open();
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(toasts).toMatchObject([
      { kind: 'failed', message: '알림을 읽음으로 표시하지 못했어요' },
    ]);
  });

  test('an already read notification still navigates without sending anything', async () => {
    await render([note({ type: 'like', target_id: 'post-9', is_read: true })]);
    await open();
    expect(mockMarkRead).not.toHaveBeenCalled();
    expect(onNavigate).toHaveBeenCalledWith({ kind: 'post', postId: 'post-9' });
  });

  test('an old notification without a target falls back to a message instead of going nowhere', async () => {
    mockMarkRead.mockReturnValue(new Promise(() => {}));
    await render([note({ type: 'like', target_id: null })]);
    await open();
    expect(onNavigate).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith(
      '응원이 도착했어요',
      expect.stringContaining('민지'),
      [{ text: '확인' }],
    );
  });

  test('without a navigation handler the notification is just shown in a message', async () => {
    mockMarkRead.mockReturnValue(new Promise(() => {}));
    await render(
      [note({ type: 'level_up', actor_name: '달료', stage: 'baby' })],
      false,
    );
    await open();
    expect(alert).toHaveBeenCalledWith('달료 성장!', expect.any(String), [
      { text: '확인' },
    ]);
  });
});
