import React from 'react';
import { Text, View as MockView } from 'react-native';
import Renderer, { act } from 'react-test-renderer';
import { CommunityScreen } from '../src/screens/community/CommunityScreen';

const mockAction = jest.fn();
const mockWatchPost = jest.fn();
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
  newSocialId: () => 'new-id',
  socialRequest: (...args: unknown[]) => mockAction(...args),
  socialError: (error: Error) => error.message,
  watchPost: (...args: unknown[]) => mockWatchPost(...args),
  watchPostFlags: (_id: string, next: (flags: unknown) => void) => {
    next({ liked: false, saved: false });
    return () => {};
  },
}));
jest.mock('../src/hooks/useSocialFeed', () => ({
  useSocialFeed: () => ({
    posts: [],
    status: 'success',
    more: false,
    loadingMore: false,
    moreError: false,
    loadMore: jest.fn(),
    refresh: jest.fn(),
  }),
}));
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
  hasUnread: () => false,
}));
jest.mock('../src/components/character/CharacterView', () => ({
  CharacterView: () => null,
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: MockView,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
}));
jest.mock(
  'lucide-react-native',
  () => new Proxy({}, { get: () => () => null }),
);

const post = {
  post_id: 'post-9',
  uid: 'peer',
  author_name: '민지',
  author_image: null,
  author_tier: 'none',
  text: '오늘도 달렸어요',
  image_url: null,
  visibility: 'public',
  run_id: null,
  distance_km: null,
  avg_pace_sec: null,
  calories: null,
  hashtags: [],
  like_count: 1,
  comment_count: 0,
  createdAtMs: Date.now(),
};
const base = { onNotificationPress: jest.fn(), onSettingsPress: jest.fn() };
let tree: Renderer.ReactTestRenderer;
const subpage = jest.fn();
const handled = jest.fn();
const texts = () =>
  tree.root
    .findAllByType(Text)
    .map(node => ([] as unknown[]).concat(node.props.children).join(''));
const hasLabel = (label: string) =>
  tree.root.findAll(node => node.props.accessibilityLabel === label).length > 0;
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
async function render(
  initialRoute?: React.ComponentProps<typeof CommunityScreen>['initialRoute'],
) {
  await act(async () => {
    tree = Renderer.create(
      <CommunityScreen
        {...base}
        initialRoute={initialRoute}
        onSubpageChange={subpage}
        onInitialRouteHandled={handled}
      />,
    );
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockWatchPost.mockImplementation(
    (_id: string, next: (value: unknown) => void) => {
      next(post);
      return () => {};
    },
  );
  mockAction.mockImplementation((action: string) =>
    action === 'profile'
      ? Promise.resolve({
          profile: {
            uid: 'peer',
            display_name: '민지',
            profile_image: null,
            total_km: 3,
            region: '서울',
            follower_count: 0,
            following_count: 0,
            influencer_tier: 'none',
          },
          following: false,
        })
      : action === 'profilePosts'
      ? Promise.resolve({ posts: [] })
      : Promise.resolve({}),
  );
});
afterEach(async () => {
  await act(async () => tree.unmount());
});

test('a post link opens that post on top of the feed, and back returns to the feed', async () => {
  await render({ page: 'post', id: 'post-9' });
  expect(mockWatchPost).toHaveBeenCalledWith(
    'post-9',
    expect.any(Function),
    expect.any(Function),
  );
  expect(hasLabel('게시물에서 뒤로')).toBe(true);
  expect(texts()).toContain('오늘도 달렸어요');
  expect(subpage).toHaveBeenLastCalledWith(true);
  await press('게시물에서 뒤로');
  expect(hasLabel('게시물에서 뒤로')).toBe(false);
  expect(subpage).toHaveBeenLastCalledWith(false);
});

test('a profile link opens that runner’s profile, and back returns to the feed', async () => {
  await render({ page: 'profile', uid: 'peer' });
  expect(mockAction).toHaveBeenCalledWith('profile', { uid: 'peer' });
  expect(hasLabel('러너 프로필에서 뒤로')).toBe(true);
  expect(subpage).toHaveBeenLastCalledWith(true);
  await press('러너 프로필에서 뒤로');
  expect(hasLabel('러너 프로필에서 뒤로')).toBe(false);
  expect(subpage).toHaveBeenLastCalledWith(false);
});

test('a post that is gone or not visible explains it instead of showing a blank screen', async () => {
  mockWatchPost.mockImplementation(
    (_id: string, next: (value: unknown) => void) => {
      next(null);
      return () => {};
    },
  );
  await render({ page: 'post', id: 'deleted' });
  expect(texts()).toContain('게시물을 볼 수 없어요');
  expect(hasLabel('게시물에서 뒤로')).toBe(true);
});

test('without a link it starts on the plain feed', async () => {
  await render();
  expect(mockWatchPost).not.toHaveBeenCalled();
  expect(hasLabel('게시물에서 뒤로')).toBe(false);
  expect(hasLabel('러너 프로필에서 뒤로')).toBe(false);
  expect(subpage).toHaveBeenLastCalledWith(false);
});

test('the parent is told once that the link was used, and a later change of the link is ignored', async () => {
  await render({ page: 'post', id: 'post-9' });
  expect(handled).toHaveBeenCalledTimes(1);
  await act(async () => {
    tree.update(
      <CommunityScreen
        {...base}
        initialRoute={{ page: 'profile', uid: 'other' }}
        onSubpageChange={subpage}
        onInitialRouteHandled={handled}
      />,
    );
  });
  expect(handled).toHaveBeenCalledTimes(1);
  expect(mockAction).not.toHaveBeenCalledWith('profile', { uid: 'other' });
  expect(hasLabel('게시물에서 뒤로')).toBe(true);
});

describe('pages stack on top of the feed', () => {
  const feedHidden = () =>
    tree.root.findAll(node => node.props.accessibilityElementsHidden === true)
      .length > 0;

  test('the feed stays underneath a page instead of being replaced, and is hidden from screen readers while covered', async () => {
    await render();
    expect(hasLabel('글쓰기')).toBe(true);
    expect(feedHidden()).toBe(false);
    await press('내 러너 프로필');
    expect(hasLabel('러너 프로필에서 뒤로')).toBe(true);
    // 피드는 지워지지 않고 아래에 그대로 있다
    expect(hasLabel('글쓰기')).toBe(true);
    expect(feedHidden()).toBe(true);
    await press('러너 프로필에서 뒤로');
    expect(hasLabel('러너 프로필에서 뒤로')).toBe(false);
    expect(feedHidden()).toBe(false);
  });

  test('pages pile up and are removed from the top one by one', async () => {
    await render({ page: 'post', id: 'post-9' });
    await press('민지 프로필');
    // 게시물 위에 프로필이 쌓이고, 게시물도 그 아래에 그대로 남아 있다
    expect(hasLabel('러너 프로필에서 뒤로')).toBe(true);
    expect(hasLabel('게시물에서 뒤로')).toBe(true);
    await press('러너 프로필에서 뒤로');
    expect(hasLabel('러너 프로필에서 뒤로')).toBe(false);
    expect(hasLabel('게시물에서 뒤로')).toBe(true);
    expect(subpage).toHaveBeenLastCalledWith(true);
    await press('게시물에서 뒤로');
    expect(hasLabel('게시물에서 뒤로')).toBe(false);
    expect(subpage).toHaveBeenLastCalledWith(false);
  });
});
