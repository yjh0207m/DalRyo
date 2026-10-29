import React from 'react';
import { AppState, FlatList, TextInput, View as MockView } from 'react-native';
import Renderer, { act } from 'react-test-renderer';
import {
  ChatScreen,
  ConversationView,
} from '../src/screens/community/ChatScreen';
import type {
  Conversation,
  ChatMessage,
  ChatPage,
} from '../src/services/chat.service';
const mockSend = jest.fn(),
  mockRead = jest.fn(),
  mockEarlier = jest.fn(),
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
  earlierMessages: (...args: unknown[]) => mockEarlier(...args),
  blockConversation: jest.fn(),
  hasUnread: (r: Conversation) =>
    r.last_sender_uid !== 'me' && r.lastSentAt > (r.read_at.me ?? 0),
  mergeChatItems: (old: ChatMessage[], fresh: ChatMessage[]) => [
    ...new Map([...old, ...fresh].map(m => [m.id, m])).values(),
  ],
}));
jest.mock(
  'lucide-react-native',
  () => new Proxy({}, { get: () => () => null }),
);
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: MockView }));
let tree: Renderer.ReactTestRenderer;
beforeEach(() => {
  AppState.currentState = 'active';
  jest.clearAllMocks();
  mockSend.mockResolvedValue({});
  mockRead.mockResolvedValue({});
  mockWatchInbox.mockImplementation(next => {
    next({ items: [], cursor: null, more: false });
    return () => {};
  });
});
afterEach(async () => {
  await act(() => tree?.unmount());
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
test('read receipt requires the latest message to be loaded and the list at the bottom', async () => {
  await render();
  const list = tree.root.findByType(FlatList);
  await act(() =>
    list.props.onScroll({ nativeEvent: { contentOffset: { y: 200 } } }),
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
    list.props.onScroll({ nativeEvent: { contentOffset: { y: 0 } } });
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
