import React from 'react';
import { Text } from 'react-native';
import Renderer, { act } from 'react-test-renderer';
import { BlockedUsersScreen } from '../src/screens/profile/BlockedUsersScreen';
import type { BlockedUser } from '../src/services/social.service';

const mockAction = jest.fn();
let mockPublish: (users: BlockedUser[]) => void;
jest.mock('../src/services/social.service', () => ({
  socialError: (error: Error) => error.message,
  socialRequest: (...args: unknown[]) => mockAction(...args),
  watchBlockedUsers: (next: (users: BlockedUser[]) => void) => {
    mockPublish = next;
    return () => {};
  },
}));
jest.mock(
  'lucide-react-native',
  () => new Proxy({}, { get: () => () => null }),
);
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: require('react-native').View,
}));

let tree: Renderer.ReactTestRenderer;
const onBack = jest.fn();
const texts = () =>
  tree.root
    .findAllByType(Text)
    .map(node => ([] as unknown[]).concat(node.props.children).join(''));
beforeEach(async () => {
  jest.clearAllMocks();
  mockAction.mockResolvedValue({});
  await act(async () => {
    tree = Renderer.create(<BlockedUsersScreen onBack={onBack} />);
  });
});
afterEach(async () => {
  await act(async () => tree.unmount());
});

test('explains itself when nobody is blocked', async () => {
  await act(async () => mockPublish([]));
  expect(texts()).toContain('차단한 사용자가 없어요');
});

test('lists blocked runners with their id, and unblocks the one chosen', async () => {
  await act(async () =>
    mockPublish([
      {
        uid: 'one',
        display_name: '민지',
        user_id: 'minji_run',
        profile_image: null,
      },
      { uid: 'two', display_name: '철수', profile_image: null },
    ]),
  );
  expect(texts()).toEqual(
    expect.arrayContaining(['민지', '@minji_run', '철수']),
  );
  const buttons = tree.root.findAll(node => node.props.label === '차단 해제');
  expect(buttons).toHaveLength(2);
  await act(async () => buttons[1].props.onPress());
  expect(mockAction).toHaveBeenCalledWith('blockUser', {
    uid: 'two',
    blocked: false,
  });
  // 목록에서 빠지는 것은 서버가 지운 뒤 실시간 구독으로 반영된다
  await act(async () =>
    mockPublish([{ uid: 'one', display_name: '민지', profile_image: null }]),
  );
  expect(texts()).not.toContain('철수');
});

test('has a way back', async () => {
  await act(async () => {
    tree.root
      .find(node => node.props.accessibilityLabel === '차단한 사용자에서 뒤로')
      .props.onPress();
  });
  expect(onBack).toHaveBeenCalledTimes(1);
});
