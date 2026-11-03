import React from 'react';
jest.mock('../src/hooks/usePostAuthor', () => ({ usePostAuthor: jest.fn() }));
import { FlatList, View as MockView } from 'react-native';
import Renderer, { act } from 'react-test-renderer';
import { ConnectionsScreen } from '../src/screens/community/ConnectionsScreen';
import { ProfilePage } from '../src/screens/community/CommunityScreen';
const mockAction = jest.fn();
jest.mock('react-native/Libraries/Lists/FlatList', () => {
  const MockReact = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: any) => (
      <View>
        {props.ListHeaderComponent}
        {props.data.map((item: any, index: number) => (
          <MockReact.Fragment key={props.keyExtractor(item)}>
            {props.renderItem({ item, index })}
          </MockReact.Fragment>
        ))}
        {!props.data.length && props.ListEmptyComponent}
        {props.ListFooterComponent}
      </View>
    ),
  };
});
jest.mock('../src/services/social.service', () => ({
  myUid: () => 'me',
  socialRequest: (...args: unknown[]) => mockAction(...args),
  socialError: (error: Error) => error.message,
  watchPostFlags: () => () => {},
}));
jest.mock('../src/hooks/useServerFeed', () => ({ useServerFeed: jest.fn() }));
jest.mock('../src/hooks/useComments', () => ({ useComments: jest.fn() }));
jest.mock('../src/services/media.service', () => ({
  choosePhoto: jest.fn(),
  uploadPhoto: jest.fn(),
}));
jest.mock('../src/services/run.service', () => ({
  fetchRecentRuns: async () => [],
}));
jest.mock('../src/services/chat.service', () => ({
  watchConversations: () => () => {},
}));
jest.mock('../src/components/character/CharacterView', () => ({
  CharacterView: (props: object) => (
    <MockView testID="profile-pet" {...props} />
  ),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: MockView,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
}));
jest.mock(
  'lucide-react-native',
  () => new Proxy({}, { get: () => () => null }),
);
const person = {
  uid: 'peer',
  display_name: '달리는 오리',
  profile_image: null,
  total_km: 12.5,
  region: '서울',
  follower_count: 2,
  following_count: 3,
  influencer_tier: 'none',
};
let tree: Renderer.ReactTestRenderer;
const profile = jest.fn(),
  message = jest.fn(),
  back = jest.fn();
function press(label: string) {
  return tree.root
    .findAll(
      node =>
        node.props.accessibilityLabel === label &&
        typeof node.props.onPress === 'function',
    )[0]
    .props.onPress();
}
beforeEach(() => {
  jest.clearAllMocks();
  mockAction.mockResolvedValue({ users: [person], cursor: null });
});
afterEach(async () => {
  await act(() => tree?.unmount());
});

test.each(['me', 'peer'])(
  'profile %s switches post layout without losing post navigation',
  async uid => {
    const post = {
      post_id: 'run-post',
      uid,
      author_name: '러너',
      author_image: null,
      author_tier: 'none',
      text: '아침 러닝',
      image_url: null,
      distance_km: 3,
      hashtags: [],
      like_count: 0,
      comment_count: 0,
      visibility: 'public',
      createdAtMs: 1000,
    };
    mockAction.mockImplementation(async action =>
      action === 'profile'
        ? { profile: { ...person, uid }, following: false, recent_runs: [] }
        : { posts: [post] },
    );
    const open = jest.fn();
    await act(() => {
      tree = Renderer.create(
        <ProfilePage
          uid={uid}
          onBack={back}
          onPost={open}
          onComments={jest.fn()}
          onMessage={message}
        />,
      );
    });
    await act(() => press('게시물 그리드 보기'));
    expect(
      tree.root.findByProps({ testID: 'profile-posts-grid' }),
    ).toBeTruthy();
    await act(() => press('아침 러닝 게시물 열기'));
    expect(open).toHaveBeenCalledWith('run-post');
    await act(() => press('게시물 목록 보기'));
    expect(
      tree.root.findAllByProps({ testID: 'profile-posts-grid' }),
    ).toHaveLength(0);
  },
);
test('following list opens a runner profile or DM directly and changes to followers', async () => {
  await act(async () => {
    tree = Renderer.create(
      <ConnectionsScreen
        uid="me"
        onBack={back}
        onProfile={profile}
        onMessage={message}
      />,
    );
  });
  expect(mockAction).toHaveBeenCalledWith('connections', {
    uid: 'me',
    kind: 'following',
  });
  await act(() => press('달리는 오리 프로필 보기'));
  await act(() => press('달리는 오리에게 메시지 보내기'));
  expect(profile).toHaveBeenCalledWith('peer');
  expect(message).toHaveBeenCalledWith('peer');
  const tabs = tree.root.findAll(
    node =>
      node.props.accessibilityRole === 'tab' &&
      typeof node.props.onPress === 'function',
  );
  await act(async () => tabs[1].props.onPress());
  expect(mockAction).toHaveBeenLastCalledWith('connections', {
    uid: 'me',
    kind: 'followers',
  });
});
test('relation pagination retains previous users and removes overlapping entries', async () => {
  mockAction
    .mockResolvedValueOnce({ users: [person], cursor: 'edge-one' })
    .mockResolvedValueOnce({
      users: [person, { ...person, uid: 'another' }],
      cursor: null,
    });
  await act(async () => {
    tree = Renderer.create(
      <ConnectionsScreen
        uid="me"
        onBack={back}
        onProfile={profile}
        onMessage={message}
      />,
    );
  });
  await act(async () =>
    tree.root.findByProps({ label: '더 보기' }).props.onPress(),
  );
  expect(mockAction).toHaveBeenLastCalledWith('connections', {
    uid: 'me',
    kind: 'following',
    cursor: 'edge-one',
  });
  expect(tree.root.findByType(FlatList).props.data).toHaveLength(2);
});
test('failed relation lookup offers retry instead of an empty-success list', async () => {
  mockAction.mockRejectedValueOnce(new Error('목록 조회 실패'));
  await act(async () => {
    tree = Renderer.create(
      <ConnectionsScreen
        uid="me"
        onBack={back}
        onProfile={profile}
        onMessage={message}
      />,
    );
  });
  expect(JSON.stringify(tree.toJSON())).toContain('목록 조회 실패');
  await act(async () =>
    tree.root.findByProps({ label: '다시 시도' }).props.onPress(),
  );
  expect(tree.root.findByType(FlatList).props.data).toHaveLength(1);
});
test('profile shows a pet and brief runs, and relationship counts navigate to lists', async () => {
  mockAction.mockImplementation(async (action: string) =>
    action === 'profile'
      ? {
          profile: person,
          following: true,
          friend: false,
          pet: {
            character_type: 'duck',
            stage: 'baby',
            pet_name: '콩이',
            is_frozen: false,
            exp: 10,
          },
          run_count: 4,
          recent_runs: [
            {
              day: '2026. 11. 2.',
              distance_km: 3,
              duration_sec: 1200,
              avg_pace_sec: 400,
            },
          ],
        }
      : { posts: [] },
  );
  const connections = jest.fn();
  await act(async () => {
    tree = Renderer.create(
      <ProfilePage
        uid="peer"
        onBack={back}
        onPost={jest.fn()}
        onComments={jest.fn()}
        onMessage={message}
        onConnections={connections}
      />,
    );
  });
  const pet = tree.root.findByProps({ testID: 'profile-pet' });
  expect(pet.props.type).toBe('duck');
  expect(pet.props.stage).toBe('baby');
  expect(JSON.stringify(tree.toJSON())).toContain('콩이');
  expect(JSON.stringify(tree.toJSON())).toContain('완료한 러닝');
  await act(() => press('팔로워 목록'));
  expect(connections).toHaveBeenCalledWith('followers');
  await act(() => press('팔로잉 목록'));
  expect(connections).toHaveBeenCalledWith('following');
  await act(() =>
    tree.root.findByProps({ label: '메시지 보내기' }).props.onPress(),
  );
  expect(message).toHaveBeenCalledWith('peer');
  expect(tree.root.findByProps({ testID: 'profile-runs-list' })).toBeTruthy();
});
