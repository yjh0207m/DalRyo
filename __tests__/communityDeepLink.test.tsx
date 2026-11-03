import React from 'react';
jest.mock('../src/hooks/usePostAuthor', () => ({ usePostAuthor: jest.fn() }));
import {
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  View as MockView,
} from 'react-native';
import Renderer, { act } from 'react-test-renderer';
import { CommunityScreen } from '../src/screens/community/CommunityScreen';
import { colors } from '../src/theme';

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
  savedPosts: () => Promise.resolve([]),
  socialRequest: (...args: unknown[]) => mockAction(...args),
  socialError: (error: Error) => error.message,
  watchPost: (...args: unknown[]) => mockWatchPost(...args),
  watchPostFlags: (_id: string, next: (flags: unknown) => void) => {
    next({ liked: false, saved: false });
    return () => {};
  },
}));
const mockFeedAction = jest.fn();
const mockExplorePosts: unknown[] = [];
jest.mock('../src/hooks/useServerFeed', () => ({
  useServerFeed: (action: string) => {
    mockFeedAction(action);
    return {
      posts: action === 'exploreFeed' ? mockExplorePosts : [],
      status: 'success',
      more: false,
      loadingMore: false,
      moreError: false,
      loadMore: jest.fn(),
      refresh: jest.fn(),
    };
  },
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
// 서브 네비게이션의 메뉴를 고른다. 화면 읽기 기능이 쓰는 동작과 같은 경로다
const chooseSubNav = (name: string) =>
  act(async () => {
    tree.root
      .find(node => node.props.accessibilityLabel === '커뮤니티 메뉴')
      .props.onAccessibilityAction({ nativeEvent: { actionName: name } });
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
            user_id: 'minji_run',
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
    await chooseSubNav('profile');
    expect(hasLabel('러너 프로필에서 뒤로')).toBe(true);
    // 피드는 지워지지 않고 아래에 그대로 있다
    expect(hasLabel('러너 랭킹')).toBe(true);
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

describe('the community header', () => {
  test('has the same bell and settings buttons as the other tabs, and nothing else', async () => {
    const onNotificationPress = jest.fn();
    await act(async () => {
      tree = Renderer.create(
        <CommunityScreen
          {...base}
          hasUnread
          onNotificationPress={onNotificationPress}
        />,
      );
    });
    expect(texts()).toContain('커뮤니티');
    expect(hasLabel('알림, 안 읽은 알림 있음')).toBe(true);
    expect(hasLabel('설정')).toBe(true);
    // 홈·성장·기록 화면과 같은 규격(40)이다
    const sizes = tree.root
      .findAll(node => node.props?.size === 40)
      .map(node => node.props.accessibilityLabel);
    expect(sizes).toEqual(
      expect.arrayContaining(['알림, 안 읽은 알림 있음', '설정']),
    );
    // 프로필·검색·메시지는 서브 네비게이션으로 옮겼다
    for (const label of ['내 러너 프로필', '러너 검색', '메시지'])
      expect(hasLabel(label)).toBe(false);
    await press('알림, 안 읽은 알림 있음');
    expect(onNotificationPress).toHaveBeenCalledTimes(1);
  });

  test('has no tagline and no 전체·팔로잉·내 게시물 selector', async () => {
    await render();
    const all = texts();
    expect(all).not.toContain('함께 달리는 이야기');
    for (const label of ['전체', '팔로잉', '내 게시물'])
      expect(all).not.toContain(label);
  });

  test('the sub navigation changes the page inside the community while both bars stay', async () => {
    await render();
    await chooseSubNav('explore');
    expect(hasLabel('탐색에서 뒤로')).toBe(true);
    // 메인 하단 바를 가리라고 부모에게 알리지 않고, 서브 네비게이션도 그대로 있다
    expect(subpage).toHaveBeenLastCalledWith(false);
    expect(hasLabel('커뮤니티 메뉴')).toBe(true);
    // 다른 메뉴로 바로 옮겨 가도 마찬가지다
    await chooseSubNav('messages');
    expect(hasLabel('탐색에서 뒤로')).toBe(false);
    expect(hasLabel('대화에서 뒤로')).toBe(true);
    expect(subpage).toHaveBeenLastCalledWith(false);
    expect(hasLabel('커뮤니티 메뉴')).toBe(true);
    await chooseSubNav('profile');
    expect(hasLabel('러너 프로필에서 뒤로')).toBe(true);
    expect(subpage).toHaveBeenLastCalledWith(false);
    expect(hasLabel('커뮤니티 메뉴')).toBe(true);
  });

  test('going back from a menu page returns to the feed, still with both bars', async () => {
    await render();
    await chooseSubNav('explore');
    await press('탐색에서 뒤로');
    expect(hasLabel('탐색에서 뒤로')).toBe(false);
    expect(hasLabel('글쓰기')).toBe(true);
    expect(hasLabel('커뮤니티 메뉴')).toBe(true);
    expect(subpage).toHaveBeenLastCalledWith(false);
  });

  test('a page opened on top of a menu page covers the bars, and closing it brings them back', async () => {
    await render({ page: 'post', id: 'post-9' });
    expect(hasLabel('커뮤니티 메뉴')).toBe(false);
    expect(subpage).toHaveBeenLastCalledWith(true);
    await press('게시물에서 뒤로');
    expect(hasLabel('커뮤니티 메뉴')).toBe(true);
    expect(subpage).toHaveBeenLastCalledWith(false);
  });
});

describe('the menu pages', () => {
  const headerTexts = () => texts();
  const contentPadding = () =>
    tree.root
      .findAllByType(ScrollView)
      .map(
        node =>
          StyleSheet.flatten(node.props.contentContainerStyle)?.paddingBottom ??
          0,
      );

  test('the feed is the followed-plus-recommended list, and the explore page is the separate explore list', async () => {
    mockExplorePosts.splice(0, mockExplorePosts.length, post);
    try {
      await render();
      expect(mockFeedAction).toHaveBeenCalledWith('homeFeed');
      expect(mockFeedAction).not.toHaveBeenCalledWith('exploreFeed');
      expect(headerTexts()).not.toContain('오늘도 달렸어요');
      await chooseSubNav('explore');
      expect(mockFeedAction).toHaveBeenCalledWith('exploreFeed');
      expect(headerTexts()).toContain('오늘도 달렸어요');
    } finally {
      mockExplorePosts.length = 0;
    }
  });

  test('the runner search is opened from the explore page and goes back to it', async () => {
    await render();
    await chooseSubNav('explore');
    await press('러너 검색');
    expect(hasLabel('러너 검색에서 뒤로')).toBe(true);
    expect(hasLabel('탐색에서 뒤로')).toBe(true);
    expect(subpage).toHaveBeenLastCalledWith(true);
    await press('러너 검색에서 뒤로');
    expect(hasLabel('탐색에서 뒤로')).toBe(true);
    expect(hasLabel('커뮤니티 메뉴')).toBe(true);
    expect(subpage).toHaveBeenLastCalledWith(false);
  });

  test('the page is not cut off above the bars: the layer fills the whole screen, with no padding that would end it early', async () => {
    await render();
    await chooseSubNav('profile');
    const layers = tree.root.findAll(node => {
      const style = StyleSheet.flatten(node.props?.style);
      return (
        typeof node.type === 'string' &&
        style?.position === 'absolute' &&
        style.backgroundColor === colors.background
      );
    });
    expect(layers.length).toBe(1);
    const style = StyleSheet.flatten(layers[0].props.style);
    expect(style.bottom).toBe(0);
    expect(style.paddingBottom).toBeUndefined();
  });

  test('the profile page leaves room at the end for both bars', async () => {
    await render();
    await chooseSubNav('profile');
    expect(Math.max(...contentPadding())).toBeGreaterThanOrEqual(150);
  });

  test('your own profile shows your @id at the top instead of the page name', async () => {
    await render();
    await chooseSubNav('profile');
    expect(headerTexts()).toContain('@minji_run');
    expect(headerTexts()).not.toContain('러너 프로필');
    // 뒤로가기 버튼의 읽기 이름은 그대로다
    expect(hasLabel('러너 프로필에서 뒤로')).toBe(true);
  });

  test('a runner who has no id yet shows their nickname at the top', async () => {
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
        : Promise.resolve({ posts: [] }),
    );
    await render({ page: 'profile', uid: 'peer' });
    expect(
      texts().filter(text => text === '민지').length,
    ).toBeGreaterThanOrEqual(2);
    expect(texts().some(text => text.startsWith('@'))).toBe(false);
  });
});

describe('the feed page', () => {
  const hasText = (value: string) => texts().includes(value);

  test('has no heading or tagline above the posts, and no saved-posts shortcut', async () => {
    await render();
    expect(hasText('러닝 이야기')).toBe(false);
    expect(hasText('각자의 속도, 함께 나누는 한 걸음')).toBe(false);
    expect(hasText('저장함')).toBe(false);
    // 러너 랭킹은 남아 있다
    expect(hasLabel('러너 랭킹')).toBe(true);
  });

  test('has a round write button at the bottom right that opens the composer', async () => {
    await render();
    const button = tree.root.find(
      node =>
        node.props?.accessibilityLabel === '글쓰기' &&
        typeof node.props.onPress === 'function',
    );
    const style = StyleSheet.flatten(button.props.style);
    expect(style.width).toBe(style.height);
    expect(style.borderRadius).toBe(style.width / 2);
    await act(async () => button.props.onPress());
    expect(hasLabel('오늘의 달리기에서 뒤로')).toBe(true);
  });

  test('the write button is on the feed and the explore page, not on messages or my profile', async () => {
    await render();
    await chooseSubNav('explore');
    expect(hasLabel('글쓰기')).toBe(true);
    for (const key of ['messages', 'profile']) {
      await chooseSubNav(key);
      expect(hasLabel('글쓰기')).toBe(false);
    }
    await chooseSubNav('feed');
    expect(hasLabel('글쓰기')).toBe(true);
  });

  test('writing from the explore page opens the composer, and posting returns to the feed', async () => {
    await render();
    await chooseSubNav('explore');
    await press('글쓰기');
    expect(hasLabel('오늘의 달리기에서 뒤로')).toBe(true);
    expect(hasLabel('커뮤니티 메뉴')).toBe(false);
  });

  test('moves up out of the way while the sub navigation is open, and comes back when it closes', async () => {
    let config: Record<string, (...args: any[]) => any> = {};
    const create = PanResponder.create.bind(PanResponder);
    const spy = jest.spyOn(PanResponder, 'create').mockImplementation(c => {
      config = c as typeof config;
      return create(c);
    });
    try {
      await render();
      const lift = () => {
        // Animated.View와 그 안쪽 View가 같은 스타일을 받으므로 첫 번째를 쓴다
        const fab = tree.root.findAll(
          node =>
            !!node.props?.style &&
            StyleSheet.flatten(node.props.style)?.position === 'absolute' &&
            StyleSheet.flatten(node.props.style)?.right !== undefined &&
            !!StyleSheet.flatten(node.props.style)?.transform,
        )[0];
        const y = StyleSheet.flatten(fab.props.style).transform[0]
          .translateY as unknown as { __getValue: () => number } | number;
        return typeof y === 'number' ? y : y.__getValue();
      };
      expect(lift()).toBe(0);
      await act(async () => config.onPanResponderGrant());
      expect(lift()).toBeLessThan(0);
      await act(async () =>
        config.onPanResponderMove({}, { moveX: 0, moveY: 0, dx: 40, dy: 0 }),
      );
      await act(async () => config.onPanResponderRelease());
      expect(lift()).toBe(0);
    } finally {
      spy.mockRestore();
    }
  });
});

describe('the explore page', () => {
  test('has no introduction text above the posts', async () => {
    await render();
    await chooseSubNav('explore');
    const all = texts();
    expect(all).not.toContain('DISCOVER');
    expect(all).not.toContain(
      '아직 팔로우하지 않은 러너들의 달리기 이야기를 둘러보세요.',
    );
  });
});

test('the saved posts can be opened straight from a link (the settings entry), and going back returns to the feed', async () => {
  await render({ page: 'saved' });
  expect(hasLabel('저장한 게시물에서 뒤로')).toBe(true);
  expect(subpage).toHaveBeenLastCalledWith(true);
  await press('저장한 게시물에서 뒤로');
  expect(hasLabel('저장한 게시물에서 뒤로')).toBe(false);
  expect(subpage).toHaveBeenLastCalledWith(false);
});
