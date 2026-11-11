import React from 'react';
import { usePostAuthor } from '../src/hooks/usePostAuthor';
jest.mock('../src/hooks/usePostAuthor', () => ({ usePostAuthor: jest.fn() }));
import {
  AppState,
  BackHandler,
  FlatList,
  Image,
  Keyboard,
  Platform,
  StyleSheet,
  TextInput,
  View as MockView,
} from 'react-native';
import Renderer, { act } from 'react-test-renderer';
import {
  byRelation,
  ChatScreen,
  ConversationView,
} from '../src/screens/community/ChatScreen';
import { socialRequest } from '../src/services/social.service';
import { ActionSheet, AppText } from '../src/components/ui';
import type {
  Conversation,
  ChatMessage,
  ChatPage,
} from '../src/services/chat.service';
const mockSend = jest.fn(),
  mockRead = jest.fn(),
  mockMute = jest.fn(),
  mockRename = jest.fn(),
  mockEarlier = jest.fn(),
  mockCreateGroup = jest.fn(),
  mockWatchInbox = jest.fn();
let mockRoomNext: (room: Conversation) => void;
let mockMessageNext: (page: ChatPage<ChatMessage>) => void;
const room = {
  id: 'room',
  members: ['me', 'peer'],
  profiles: {
    me: { display_name: '나', profile_image: null },
    peer: { display_name: '친구', profile_image: null },
  },
  blocked_by: [],
  read_at: {},
  last_text: '안녕',
  last_sender_uid: 'peer',
  last_message_id: 'one',
  lastSentAt: 1000,
  updatedAt: 1000,
} as Conversation;
const one = { id: 'one', sender_uid: 'peer', text: '안녕', createdAt: 1000 };
jest.mock('../src/services/social.service', () => ({
  myUid: () => 'me',
  socialError: (e: Error) => e.message,
  socialRequest: jest.fn(),
}));
jest.mock('../src/services/chat.service', () => ({
  watchConversations: (...args: unknown[]) => mockWatchInbox(...args),
  watchConversation: (_id: string, next: typeof mockRoomNext) => {
    mockRoomNext = next;
    next(room);
    return () => {};
  },
  watchMessages: (_id: string, next: typeof mockMessageNext) => {
    mockMessageNext = next;
    next({ items: [one], cursor: { id: 'first' } as never, more: true });
    return () => {};
  },
  newMessageId: () => 'stable-message',
  sendMessage: (...args: unknown[]) => mockSend(...args),
  markConversationRead: (...args: unknown[]) => mockRead(...args),
  setConversationMuted: (...args: unknown[]) => mockMute(...args),
  renameGroupConversation: (...args: unknown[]) => mockRename(...args),
  earlierMessages: (...args: unknown[]) => mockEarlier(...args),
  blockConversation: jest.fn(),
  createGroupConversation: (...args: unknown[]) => mockCreateGroup(...args),
  hasUnread: (r: Conversation) =>
    r.last_sender_uid !== 'me' && r.lastSentAt > (r.read_at.me ?? 0),
  mergeChatItems: (old: ChatMessage[], fresh: ChatMessage[]) => [
    ...new Map([...old, ...fresh].map(m => [m.id, m])).values(),
  ],
}));
jest.mock('lucide-react-native', () => {
  // 아이콘마다 이름을 붙여 두면 테스트에서 어떤 아이콘인지 알아볼 수 있다
  const cache: Record<string, () => null> = {};
  return new Proxy(
    {},
    {
      get: (_target, name: string) =>
        (cache[name] ??= Object.assign(() => null, { displayName: name })),
    },
  );
});
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: MockView,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
let tree: Renderer.ReactTestRenderer;
beforeEach(() => {
  AppState.currentState = 'active';
  jest.clearAllMocks();
  (usePostAuthor as jest.Mock).mockReturnValue(undefined);
  (socialRequest as jest.Mock).mockResolvedValue({ users: [], cursor: null });
  mockSend.mockResolvedValue({});
  mockRead.mockResolvedValue({});
  mockMute.mockResolvedValue({});
  mockRename.mockResolvedValue({});
  mockWatchInbox.mockImplementation(next => {
    next({ items: [], cursor: null, more: false });
    return () => {};
  });
});
afterEach(async () => {
  await act(() => tree?.unmount());
  jest.restoreAllMocks();
});
async function render() {
  await act(async () => {
    tree = Renderer.create(<ConversationView id="room" onBack={jest.fn()} />);
  });
}
function sendButton() {
  return tree.root
    .findAll(n => typeof n.type === 'function' && n.type.name === 'Pressable')
    .find(n => n.props.accessibilityLabel === '메시지 전송')!;
}
async function type(value: string) {
  await act(() => tree.root.findByType(TextInput).props.onChangeText(value));
}

function messageLabels(prefix: string) {
  return tree.root
    .findAllByType(AppText)
    .filter(node => node.props.testID?.startsWith(prefix));
}

test('only the last consecutive message from the same sender in a minute shows its time', async () => {
  await render();
  const start = new Date(2026, 10, 11, 12, 0).getTime();
  await act(() =>
    mockMessageNext({
      items: [
        { ...one, id: 'a', sender_uid: 'me', createdAt: start },
        { ...one, id: 'b', sender_uid: 'me', createdAt: start + 1000 },
        { ...one, id: 'c', createdAt: start + 2000 },
        { ...one, id: 'd', sender_uid: 'me', createdAt: start + 3000 },
        { ...one, id: 'e', sender_uid: 'me', createdAt: start + 60000 },
        { ...one, id: 'f', sender_uid: 'me', createdAt: start + 86460000 },
      ],
      cursor: null,
      more: false,
    }),
  );
  // The initial fixture is also present; a later peer message in another minute
  // must keep its own time, even if the displayed clock time is the same.
  expect(messageLabels('message-time-').map(node => node.props.testID)).toEqual(
    [
      'message-time-one',
      'message-time-b',
      'message-time-c',
      'message-time-d',
      'message-time-e',
      'message-time-f',
    ],
  );

  await act(() =>
    mockMessageNext({
      items: [
        { ...one, id: 'g', sender_uid: 'me', createdAt: start + 86461000 },
      ],
      cursor: null,
      more: false,
    }),
  );
  expect(
    messageLabels('message-time-').map(node => node.props.testID),
  ).not.toContain('message-time-f');
  expect(
    messageLabels('message-time-').map(node => node.props.testID),
  ).toContain('message-time-g');
});

test('each sent message hides its unread number once the peer has read it', async () => {
  await render();
  await act(() => {
    mockRoomNext({ ...room, read_at: { me: 3000, peer: 1500 } });
    mockMessageNext({
      items: [
        { ...one, id: 'first', sender_uid: 'me', createdAt: 1100 },
        { ...one, id: 'second', sender_uid: 'me', createdAt: 2000 },
        { ...one, id: 'reply', createdAt: 3000 },
      ],
      cursor: null,
      more: false,
    });
  });
  expect(
    messageLabels('message-unread-').map(node => [
      node.props.testID,
      node.props.children,
    ]),
  ).toEqual([['message-unread-second', 1]]);
  await act(() => mockRoomNext({ ...room, read_at: { me: 3000, peer: 3000 } }));
  expect(messageLabels('message-unread-')).toHaveLength(0);
});

test('group unread numbers decrease and disappear, excluding the sender and former members', async () => {
  await render();
  await act(() => {
    mockRoomNext({
      ...room,
      kind: 'group',
      members: ['me', 'peer', 'other'],
      read_at: { me: 4000, peer: 2000, other: 1000, departed: 0 },
    });
    mockMessageNext({
      items: [
        { ...one, id: 'first', sender_uid: 'me', createdAt: 1500 },
        { ...one, id: 'second', sender_uid: 'me', createdAt: 3000 },
      ],
      cursor: null,
      more: false,
    });
  });
  expect(
    messageLabels('message-unread-').map(node => node.props.children),
  ).toEqual([1, 2]);
  await act(() =>
    mockRoomNext({
      ...room,
      kind: 'group',
      members: ['me', 'peer', 'other'],
      read_at: { me: 4000, peer: 4000, other: 2000 },
    }),
  );
  expect(
    messageLabels('message-unread-').map(node => [
      node.props.testID,
      node.props.children,
    ]),
  ).toEqual([['message-unread-second', 1]]);
  await act(() =>
    mockRoomNext({
      ...room,
      kind: 'group',
      members: ['me', 'peer'],
      read_at: { me: 4000, peer: 4000, other: 4000 },
    }),
  );
  expect(messageLabels('message-unread-')).toHaveLength(0);
});

test('the direct conversation menu offers profile and block separately', async () => {
  const onProfile = jest.fn();
  await act(() => {
    tree = Renderer.create(
      <ConversationView id="room" onBack={jest.fn()} onProfile={onProfile} />,
    );
  });
  const menuButton = tree.root.find(
    node =>
      typeof node.type === 'function' &&
      node.type.name === 'IconButton' &&
      node.props.accessibilityLabel === '대화 설정',
  );
  await act(() => menuButton.props.onPress());
  const sheet = tree.root.findByType(ActionSheet);
  expect(sheet.props.visible).toBe(true);
  expect(
    sheet.props.items.map((item: { label: string }) => item.label),
  ).toEqual(['상대 프로필 보기', '이 방 알림 끄기', '대화 차단']);
  await act(() => sheet.props.items[0].onPress());
  expect(onProfile).toHaveBeenCalledWith('peer');
});

test('group messages show the correct authors and the menu shows participants and leave', async () => {
  await render();
  await act(() => {
    mockRoomNext({
      ...room,
      kind: 'group',
      name: '아침 러닝',
      members: ['me', 'peer', 'other'],
      profiles: {
        ...room.profiles,
        other: { display_name: '다른 러너', profile_image: null },
      },
    });
    mockMessageNext({
      items: [
        { ...one, id: 'two', sender_uid: 'other', text: '반가워요' },
        one,
      ],
      cursor: null,
      more: false,
    });
  });
  const texts = tree.root
    .findAll(node => String(node.type) === 'Text')
    .map(node => node.props.children);
  expect(texts).toEqual(
    expect.arrayContaining([
      '아침 러닝',
      '그룹 채팅 · 3명',
      '친구',
      '다른 러너',
      '반가워요',
    ]),
  );
  const sheet = tree.root.findByType(ActionSheet);
  expect(
    sheet.props.items.map((item: { label: string }) => item.label),
  ).toEqual([
    '참여자 3명 보기',
    '채팅방 이름 변경',
    '이 방 알림 끄기',
    '채팅방 나가기',
  ]);
});

test('the notification setting follows this member and updates only this room', async () => {
  await render();
  const choose = (label: string) =>
    act(async () => {
      const item = tree.root
        .findByType(ActionSheet)
        .props.items.find(
          (option: { label: string }) => option.label === label,
        );
      await item.onPress();
    });
  await act(() => mockRoomNext({ ...room, muted_by: ['peer'] }));
  await choose('이 방 알림 끄기');
  expect(mockMute).toHaveBeenLastCalledWith('room', true);
  await act(() => mockRoomNext({ ...room, muted_by: ['peer', 'me'] }));
  await choose('이 방 알림 켜기');
  expect(mockMute).toHaveBeenLastCalledWith('room', false);
});

test('group rename keeps the entered name on failure and saves it on retry', async () => {
  await render();
  const group: Conversation = { ...room, kind: 'group', name: '아침 러닝' };
  await act(() => mockRoomNext(group));
  await act(() =>
    tree.root
      .findByType(ActionSheet)
      .props.items.find(
        (item: { label: string }) => item.label === '채팅방 이름 변경',
      )
      .onPress(),
  );
  const input = () =>
    tree.root
      .findAllByType(TextInput)
      .find(node => node.props.accessibilityLabel === '새 채팅방 이름')!;
  expect(input().props.value).toBe('아침 러닝');
  await act(() => input().props.onChangeText(' 저녁 러닝 '));
  mockRename.mockRejectedValueOnce(new Error('잠시 연결이 끊겼어요'));
  const save = () =>
    act(async () => tree.root.findByProps({ label: '저장' }).props.onPress());
  await save();
  expect(input().props.value).toBe(' 저녁 러닝 ');
  await save();
  expect(mockRename).toHaveBeenLastCalledWith('room', '저녁 러닝');
  await act(() => mockRoomNext({ ...group, name: '저녁 러닝' }));
  expect(input()).toBeUndefined();
  expect(
    tree.root
      .findAllByType(AppText)
      .some(node => node.props.children === '저녁 러닝'),
  ).toBe(true);
});

test('returning from runner search reconnects the inbox after a listener error', async () => {
  mockWatchInbox.mockImplementationOnce((_next, error) => {
    error(new Error('temporary'));
    return () => {};
  });
  await act(async () => {
    tree = Renderer.create(<ChatScreen onBack={jest.fn()} />);
  });
  const press = (label: string) =>
    tree.root
      .findAll(n => typeof n.type === 'function' && n.type.name === 'Pressable')
      .find(n => n.props.accessibilityLabel === label)!
      .props.onPress();
  await act(() => press('새 대화'));
  await act(async () => {
    press('대화에서 뒤로');
  });
  expect(mockWatchInbox).toHaveBeenCalledTimes(2);
});

test('tells the parent when it is inside a sub screen, so the bottom bars can be hidden there', async () => {
  const onDetailChange = jest.fn();
  await act(async () => {
    tree = Renderer.create(
      <ChatScreen onBack={jest.fn()} onDetailChange={onDetailChange} />,
    );
  });
  expect(onDetailChange).toHaveBeenLastCalledWith(false);
  const press = (label: string) =>
    tree.root
      .findAll(n => typeof n.type === 'function' && n.type.name === 'Pressable')
      .find(n => n.props.accessibilityLabel === label)!
      .props.onPress();
  await act(() => press('새 대화'));
  expect(onDetailChange).toHaveBeenLastCalledWith(true);
  await act(async () => {
    press('대화에서 뒤로');
  });
  expect(onDetailChange).toHaveBeenLastCalledWith(false);
});

test('send failure keeps draft and retries with the same message id', async () => {
  await render();
  await type('함께 달릴까요?');
  mockSend.mockRejectedValueOnce(new Error('offline'));
  await act(async () => {
    await sendButton().props.onPress();
  });
  expect(tree.root.findByType(TextInput).props.value).toBe('함께 달릴까요?');
  await act(async () => {
    await sendButton().props.onPress();
  });
  expect(mockSend.mock.calls).toEqual([
    ['room', 'stable-message', '함께 달릴까요?'],
    ['room', 'stable-message', '함께 달릴까요?'],
  ]);
  expect(tree.root.findByType(TextInput).props.value).toBe('');
});
test('rapid repeated send presses cannot issue concurrent mutations', async () => {
  await render();
  await type('응원해요');
  let finish!: (value: unknown) => void;
  mockSend.mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  const press = sendButton().props.onPress;
  await act(() => {
    press();
    press();
  });
  expect(mockSend).toHaveBeenCalledTimes(1);
  expect(sendButton().props.disabled).toBe(true);
  await act(async () => {
    finish({});
  });
});
test('sending keeps the composer editable and preserves a newer draft', async () => {
  let finish!: () => void;
  mockSend.mockImplementationOnce(
    () =>
      new Promise<void>(resolve => {
        finish = resolve;
      }),
  );
  await render();
  await type('첫 메시지');
  let sending!: Promise<void>;
  await act(() => {
    sending = sendButton().props.onPress();
  });
  expect(tree.root.findByType(TextInput).props.editable).toBe(true);
  expect(sendButton().props.disabled).toBe(true);
  await type('다음 메시지 작성 중');
  await act(async () => {
    finish();
    await sending;
  });
  expect(tree.root.findByType(TextInput).props.value).toBe(
    '다음 메시지 작성 중',
  );
});

test('blocking disables sending without discarding input', async () => {
  await render();
  await type('초안');
  await act(() => mockRoomNext({ ...room, blocked_by: ['peer'] }));
  expect(sendButton().props.disabled).toBe(true);
  await act(async () => {
    await sendButton().props.onPress();
  });
  expect(mockSend).not.toHaveBeenCalled();
  expect(tree.root.findByType(TextInput).props.value).toBe('초안');
});

test('old messages use the current peer photo even when the room was created without one', async () => {
  (usePostAuthor as jest.Mock).mockImplementation(uid =>
    uid === 'peer'
      ? {
          display_name: '친구',
          profile_image: 'https://example.test/current-peer.jpg',
        }
      : undefined,
  );
  await render();
  expect(room.profiles.peer.profile_image).toBeNull();
  expect(
    tree.root.findAllByType(Image).map(image => image.props.source.uri),
  ).toContain('https://example.test/current-peer.jpg');
  (usePostAuthor as jest.Mock).mockReturnValue({
    display_name: '친구',
    profile_image: null,
  });
  await act(() =>
    tree.update(<ConversationView id="room" onBack={jest.fn()} />),
  );
  expect(tree.root.findAllByType(Image)).toHaveLength(0);
});
test('read receipt requires the latest message to be loaded and the list at the bottom', async () => {
  await render();
  const list = tree.root.findByType(FlatList);
  await act(() => list.props.onScrollBeginDrag());
  await act(() =>
    list.props.onScroll({
      nativeEvent: {
        contentOffset: { y: 0 },
        layoutMeasurement: { height: 400 },
        contentSize: { height: 1000 },
      },
    }),
  );
  mockRead.mockClear();
  const two = { ...one, id: 'two', createdAt: 2000 };
  await act(() => {
    mockRoomNext({ ...room, last_message_id: 'two', lastSentAt: 2000 });
    mockMessageNext({
      items: [two, one],
      cursor: { id: 'first' } as never,
      more: true,
    });
  });
  expect(mockRead).not.toHaveBeenCalled();
  await act(async () => {
    list.props.onScroll({
      nativeEvent: {
        contentOffset: { y: 600 },
        layoutMeasurement: { height: 400 },
        contentSize: { height: 1000 },
      },
    });
  });
  expect(mockRead).toHaveBeenCalledWith('room', 'two');
});
test('realtime updates do not rewind the older-message pagination cursor', async () => {
  await render();
  const olderCursor = { id: 'older-cursor' },
    old = { ...one, id: 'old', createdAt: 10 };
  mockEarlier.mockResolvedValue({
    items: [old],
    cursor: olderCursor,
    more: true,
  });
  await act(async () => {
    await tree.root
      .findByProps({ label: '이전 메시지 더 보기' })
      .props.onPress();
  });
  await act(() =>
    mockMessageNext({
      items: [{ ...one, id: 'new', createdAt: 2000 }, one],
      cursor: { id: 'first' } as never,
      more: true,
    }),
  );
  await act(async () => {
    await tree.root
      .findByProps({ label: '이전 메시지 더 보기' })
      .props.onPress();
  });
  expect(mockEarlier).toHaveBeenLastCalledWith('room', olderCursor);
});

test('messages use normal orientation and chronological order on the first render', async () => {
  await render();
  const old = { ...one, id: 'old', text: '먼저 보낸 메시지', createdAt: 100 };
  await act(() =>
    mockMessageNext({ items: [one, old], cursor: null, more: false }),
  );
  const list = tree.root.findByType(FlatList);
  expect(list.props.inverted).not.toBe(true);
  expect(list.props.data.map((message: ChatMessage) => message.id)).toEqual([
    'old',
    'one',
  ]);
  expect(list.props.ListHeaderComponent).toBeNull();
});

test('composer reserves space when the keyboard opens and restores it on close', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  const listeners: Record<string, (event: any) => void> = {};
  const spy = jest
    .spyOn(Keyboard, 'addListener')
    .mockImplementation((name, listener) => {
      listeners[name] = listener;
      return { remove: jest.fn() } as unknown as ReturnType<
        typeof Keyboard.addListener
      >;
    });
  await render();
  await act(() =>
    listeners.keyboardDidShow({ endCoordinates: { height: 300 } }),
  );
  expect(
    StyleSheet.flatten(
      tree.root.findByProps({ testID: 'dm-keyboard-region' }).props.style,
    ).paddingBottom,
  ).toBeGreaterThan(0);
  await act(() => listeners.keyboardDidHide({}));
  expect(
    StyleSheet.flatten(
      tree.root.findByProps({ testID: 'dm-keyboard-region' }).props.style,
    ).paddingBottom,
  ).toBe(0);
  spy.mockRestore();
});

test.each(['android', 'ios'] as const)(
  'latest message follows keyboard layout and delayed sent-message delivery on %s',
  async os => {
    jest.replaceProperty(Platform, 'OS', os);
    const listeners: Record<string, (event: any) => void> = {};
    jest.spyOn(Keyboard, 'addListener').mockImplementation((name, listener) => {
      listeners[name] = listener;
      return { remove: jest.fn() } as unknown as ReturnType<
        typeof Keyboard.addListener
      >;
    });
    jest
      .spyOn(globalThis, 'requestAnimationFrame')
      .mockImplementation(callback => {
        callback(0);
        return 1;
      });
    jest.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});
    await render();
    const list = tree.root.findByType(FlatList);
    const scroll = jest
      .spyOn(list.instance, 'scrollToEnd')
      .mockImplementation(() => {});
    await act(() => list.props.onScrollBeginDrag());
    await act(() =>
      list.props.onScroll({
        nativeEvent: {
          contentOffset: { y: 0 },
          layoutMeasurement: { height: 300 },
          contentSize: { height: 1000 },
        },
      }),
    );
    await act(() =>
      listeners.keyboardDidShow({ endCoordinates: { height: 300 } }),
    );
    scroll.mockClear();
    await act(() =>
      list.props.onLayout({ nativeEvent: { layout: { height: 250 } } }),
    );
    expect(scroll).toHaveBeenCalled();
    expect(
      tree.root.findByType(FlatList).props.maintainVisibleContentPosition,
    ).toBeUndefined();
    await type('내 새 메시지');
    await act(async () => sendButton().props.onPress());
    scroll.mockClear();
    await act(() =>
      mockMessageNext({
        items: [
          {
            ...one,
            id: 'sent',
            sender_uid: 'me',
            text: '내 새 메시지',
            createdAt: 2000,
          },
        ],
        cursor: null,
        more: false,
      }),
    );
    await act(() => list.props.onContentSizeChange(360, 1200));
    expect(scroll).toHaveBeenCalled();
  },
);

describe('the messages list page', () => {
  const textsOf = () =>
    tree.root
      .findAll(n => String(n.type) === 'Text')
      .map(n => ([] as unknown[]).concat(n.props.children).join(''));
  const pressable = (label: string) =>
    tree.root.find(
      n =>
        typeof n.type === 'function' &&
        n.type.name === 'Pressable' &&
        n.props.accessibilityLabel === label,
    );
  async function renderList(
    props: Partial<React.ComponentProps<typeof ChatScreen>> = {},
  ) {
    mockWatchInbox.mockImplementation(next => {
      next({ items: [room], cursor: null, more: false });
      return () => {};
    });
    await act(async () => {
      tree = Renderer.create(<ChatScreen onBack={jest.fn()} {...props} />);
    });
  }

  test('has no tagline and no “find among followers” button', async () => {
    await renderList({ onTogether: jest.fn() });
    const all = textsOf();
    expect(all).not.toContain('RUN TOGETHER, TALK TOGETHER');
    expect(all).not.toContain('러닝 이야기도, 다음 약속도 여기서.');
    expect(all).not.toContain('팔로잉·팔로워에서 찾기');
  });

  test('existing conversation rows use the current peer photo rather than the room snapshot', async () => {
    (usePostAuthor as jest.Mock).mockImplementation(uid =>
      uid === 'peer'
        ? {
            display_name: '친구',
            profile_image: 'https://example.test/latest-inbox.jpg',
          }
        : undefined,
    );
    await renderList();
    expect(
      tree.root.findAllByType(Image).map(image => image.props.source.uri),
    ).toContain('https://example.test/latest-inbox.jpg');
  });

  test('has a “같이 달리기” button above the conversations', async () => {
    const onTogether = jest.fn();
    await renderList({ onTogether });
    const button = tree.root.find(n => n.props?.label === '같이 달리기');
    await act(async () => button.props.onPress());
    expect(onTogether).toHaveBeenCalledTimes(1);
    const order = tree.root.findAll(() => true);
    const together = order.indexOf(button);
    const firstRoom = order.indexOf(
      order.find(n => n.props?.accessibilityLabel === '친구 대화, 새 메시지')!,
    );
    expect(together).toBeGreaterThan(-1);
    expect(together).toBeLessThan(firstRoom);
  });

  test('does not show the button when the app gives no handler', async () => {
    await renderList();
    expect(
      tree.root.findAll(n => n.props?.label === '같이 달리기'),
    ).toHaveLength(0);
  });

  test('starts a new chat with a plus icon instead of a message icon', async () => {
    await renderList();
    const icons = pressable('새 대화').findAll(
      n =>
        typeof n.type === 'function' &&
        !!(n.type as { displayName?: string }).displayName,
    );
    const names = icons.map(
      n => (n.type as { displayName: string }).displayName,
    );
    expect(names).toContain('Plus');
    expect(names).not.toContain('MessageSquare');
  });
});

describe('searching for someone to start a chat with', () => {
  test('shows followed runners before searching, loads another page, and restores them after clearing search', async () => {
    jest.useFakeTimers();
    const followed = {
      uid: 'followed',
      display_name: '팔로우 친구',
      profile_image: null,
    };
    (socialRequest as jest.Mock).mockImplementation(
      async (action: string, input: any) =>
        action === 'search'
          ? {
              users: [{ ...followed, uid: 'found', display_name: '검색 친구' }],
            }
          : input.cursor
          ? { users: [followed, { ...followed, uid: 'second' }], cursor: null }
          : { users: [followed], cursor: 'page2' },
    );
    await act(() => {
      tree = Renderer.create(<ChatScreen onBack={jest.fn()} />);
    });
    await act(() =>
      tree.root
        .findAll(
          n =>
            n.props.accessibilityLabel === '새 대화' &&
            typeof n.props.onPress === 'function',
        )[0]
        .props.onPress(),
    );
    await act(async () => {
      jest.runOnlyPendingTimers();
    });
    expect(socialRequest).toHaveBeenCalledWith('connections', {
      uid: 'me',
      kind: 'following',
    });
    expect(
      tree.root.findByType(FlatList).props.data.map((p: any) => p.uid),
    ).toEqual(['followed']);
    await act(async () =>
      tree.root.findByProps({ label: '더 보기' }).props.onPress(),
    );
    expect(
      tree.root.findByType(FlatList).props.data.map((p: any) => p.uid),
    ).toEqual(['followed', 'second']);
    await act(() => tree.root.findByType(TextInput).props.onChangeText('검색'));
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    expect(tree.root.findByType(FlatList).props.data[0].uid).toBe('found');
    await act(() => tree.root.findByType(TextInput).props.onChangeText('  '));
    await act(async () => {
      jest.runOnlyPendingTimers();
    });
    expect(tree.root.findByType(FlatList).props.data[0].uid).toBe('followed');
    jest.useRealTimers();
  });
  const person = (
    uid: string,
    name: string,
    relation?: 'following' | 'follower' | 'none',
  ) => ({
    uid,
    display_name: name,
    profile_image: null,
    total_km: 0,
    region: '서울',
    follower_count: 0,
    following_count: 0,
    influencer_tier: 'none',
    relation,
  });

  test('a group keeps selections across searches and retries creation with the same request ID', async () => {
    jest.useFakeTimers();
    try {
      (socialRequest as jest.Mock).mockImplementation(async action => ({
        users:
          action === 'search' ? [person('b', '민준')] : [person('a', '민서')],
      }));
      mockCreateGroup
        .mockRejectedValueOnce(new Error('offline'))
        .mockResolvedValueOnce('group-room');
      await act(() => {
        tree = Renderer.create(<ChatScreen onBack={jest.fn()} />);
      });
      const button = (label: string) =>
        tree.root.find(
          node =>
            typeof node.type === 'function' &&
            node.type.name === 'Pressable' &&
            node.props.accessibilityLabel === label,
        );
      await act(() => button('새 대화').props.onPress());
      await act(() => button('그룹 채팅 만들기').props.onPress());
      await act(async () => jest.runOnlyPendingTimers());
      await act(() => button('민서').props.onPress());
      expect(button('그룹 만들기').props.disabled).toBe(true);
      await act(() =>
        tree.root
          .findByProps({ accessibilityLabel: '대화 상대 검색', maxLength: 21 })
          .props.onChangeText('민준'),
      );
      await act(async () => jest.advanceTimersByTime(300));
      await act(() => button('민준').props.onPress());
      await act(() =>
        tree.root
          .findByProps({ accessibilityLabel: '채팅방 이름', maxLength: 40 })
          .props.onChangeText('아침 러닝'),
      );
      await act(() => button('그룹 만들기').props.onPress());
      expect(button('민서 선택 해제')).toBeDefined();
      await act(() => button('그룹 만들기').props.onPress());
      expect(mockCreateGroup.mock.calls).toEqual([
        [['a', 'b'], '아침 러닝', 'stable-message'],
        [['a', 'b'], '아침 러닝', 'stable-message'],
      ]);
      expect(tree.root.findByType(ConversationView).props.id).toBe(
        'group-room',
      );
    } finally {
      jest.useRealTimers();
    }
  });

  test('lists people I follow first, then people who follow me, then strangers, and says which is which', async () => {
    jest.useFakeTimers();
    (socialRequest as jest.Mock).mockResolvedValue({
      users: [
        person('s1', '민아', 'none'),
        person('f1', '민준', 'follower'),
        person('me', '민나(나)', 'none'),
        person('g1', '민서', 'following'),
        person('s2', '민호', 'none'),
      ],
    });
    await act(async () => {
      tree = Renderer.create(<ChatScreen onBack={jest.fn()} />);
    });
    const press = (label: string) =>
      tree.root
        .findAll(
          n => typeof n.type === 'function' && n.type.name === 'Pressable',
        )
        .find(n => n.props.accessibilityLabel === label)!
        .props.onPress();
    await act(async () => press('새 대화'));
    await act(async () => {
      tree.root
        .findByProps({ accessibilityLabel: '대화 상대 검색' })
        .props.onChangeText('민');
    });
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    const rows = tree.root
      .findAll(
        n =>
          typeof n.type === 'function' &&
          n.type.name === 'Pressable' &&
          String(n.props.accessibilityLabel).endsWith('에게 메시지'),
      )
      .map(n => n.props.accessibilityLabel);
    expect(rows).toEqual([
      '민서에게 메시지',
      '민준에게 메시지',
      '민아에게 메시지',
      '민호에게 메시지',
    ]);
    const labels = tree.root
      .findAll(n => String(n.type) === 'Text')
      .map(n => ([] as unknown[]).concat(n.props.children).join(''));
    expect(labels).toContain('팔로잉');
    expect(labels).toContain('나를 팔로우');
    jest.useRealTimers();
  });

  test('the order rule keeps the server order inside each group', () => {
    const sorted = byRelation([
      person('a', 'a', 'none'),
      person('b', 'b', 'following'),
      person('c', 'c', 'follower'),
      person('d', 'd', 'following'),
      person('e', 'e'),
    ]);
    expect(sorted.map(p => p.uid)).toEqual(['b', 'd', 'c', 'a', 'e']);
  });
});

describe('the back button of the messages list', () => {
  const backs = () =>
    tree.root.findAll(
      node => node.props?.accessibilityLabel === '대화에서 뒤로',
    );
  beforeEach(() => {
    mockWatchInbox.mockImplementation(next => {
      next({ items: [room], cursor: null, more: false });
      return () => {};
    });
  });

  test('is there by default', async () => {
    await act(async () => {
      tree = Renderer.create(<ChatScreen onBack={jest.fn()} />);
    });
    expect(backs().length).toBeGreaterThan(0);
  });

  test('can be left out, and the title then lines up with the content', async () => {
    await act(async () => {
      tree = Renderer.create(<ChatScreen hideBack onBack={jest.fn()} />);
    });
    expect(backs()).toHaveLength(0);
    expect(
      tree.root.findAll(
        node =>
          typeof node.type === 'string' &&
          StyleSheet.flatten(node.props.style)?.paddingLeft === 20,
      ).length,
    ).toBeGreaterThan(0);
  });

  test('is still there inside a new chat or a conversation, which are pages of their own', async () => {
    await act(async () => {
      tree = Renderer.create(<ChatScreen hideBack onBack={jest.fn()} />);
    });
    await act(async () => {
      tree.root
        .findAll(n => n.props?.accessibilityLabel === '새 대화')[0]
        .props.onPress();
    });
    expect(backs().length).toBeGreaterThan(0);
  });

  test('the system back button still works from the list', async () => {
    const onBack = jest.fn();
    const handlers: Array<() => boolean> = [];
    const spy = jest
      .spyOn(BackHandler, 'addEventListener')
      .mockImplementation((_name, handler) => {
        handlers.push(handler as () => boolean);
        return { remove: () => undefined } as never;
      });
    try {
      await act(async () => {
        tree = Renderer.create(<ChatScreen hideBack onBack={onBack} />);
      });
      await act(async () => {
        handlers.at(-1)!();
      });
      expect(onBack).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });
});
