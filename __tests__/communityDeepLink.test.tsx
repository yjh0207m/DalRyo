import React from 'react';
jest.mock('../src/hooks/usePostAuthor', () => ({ usePostAuthor: jest.fn() }));
import {
  Alert,
  BackHandler,
  Modal,
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
const mockHomePosts: unknown[] = [];
const mockHidden = {
  blockedUids: new Set<string>(),
  hiddenPostIds: new Set<string>(),
};
jest.mock('../src/hooks/useServerFeed', () => ({
  useServerFeed: (action: string) => {
    mockFeedAction(action);
    return {
      posts: action === 'exploreFeed' ? mockExplorePosts : mockHomePosts,
      status: 'success',
      more: false,
      loadingMore: false,
      moreError: false,
      loadMore: jest.fn(),
      refresh: jest.fn(),
    };
  },
}));
jest.mock('../src/hooks/useHiddenContent', () => ({
  useHiddenContent: () => mockHidden,
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
// 서브 네비게이션으로 오가는 화면이 떠 있는지(뒤로 가기 버튼이 없으니 표지로 찾는다)
const shown = (id: string) =>
  tree.root.findAll(node => node.props?.testID === id).length > 0;
// 시스템 뒤로 가기(안드로이드 버튼, iOS 가장자리 스와이프가 부르는 것). 가장 나중에 등록된 처리기부터 불린다
const backHandlers: Array<() => boolean | null | undefined> = [];
const systemBack = () =>
  act(async () => {
    for (const handler of [...backHandlers].reverse()) if (handler()) break;
  });
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
  backHandlers.length = 0;
  jest
    .spyOn(BackHandler, 'addEventListener')
    .mockImplementation((_name, handler) => {
      backHandlers.push(handler);
      return {
        remove: () => {
          backHandlers.splice(backHandlers.indexOf(handler), 1);
        },
      } as never;
    });
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
  jest.restoreAllMocks();
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
  // 접힌 서브 네비게이션 항목도 숨겨져 있으므로, 피드를 감싼 영역만 본다
  const feedHidden = () =>
    tree.root.findAll(
      node =>
        node.props.accessibilityElementsHidden === true &&
        node.findAll(inner => inner.props.accessibilityLabel === '러너 랭킹')
          .length > 0,
    ).length > 0;

  test('the feed stays underneath a page instead of being replaced, and is hidden from screen readers while covered', async () => {
    await render();
    expect(hasLabel('글쓰기')).toBe(true);
    expect(feedHidden()).toBe(false);
    await chooseSubNav('profile');
    expect(shown('section-profile')).toBe(true);
    // 피드는 지워지지 않고 아래에 그대로 있다
    expect(hasLabel('러너 랭킹')).toBe(true);
    expect(feedHidden()).toBe(true);
    await chooseSubNav('feed');
    expect(shown('section-profile')).toBe(false);
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
    expect(texts()).toContain('RUNNER’S CLUB');
    expect(texts()).not.toContain('커뮤니티');
    expect(hasLabel('알림, 안 읽은 알림 있음')).toBe(true);
    expect(hasLabel('설정')).toBe(true);
    // 아이콘의 눌리는 영역은 44를 유지한다.
    const sizes = tree.root
      .findAll(node => node.props?.size === 44)
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
    expect(shown('section-explore')).toBe(true);
    // 메인 하단 바를 가리라고 부모에게 알리지 않고, 서브 네비게이션도 그대로 있다
    expect(subpage).toHaveBeenLastCalledWith(false);
    expect(hasLabel('커뮤니티 메뉴')).toBe(true);
    // 다른 메뉴로 바로 옮겨 가도 마찬가지다
    await chooseSubNav('messages');
    expect(shown('section-explore')).toBe(false);
    expect(shown('chat-list')).toBe(true);
    expect(subpage).toHaveBeenLastCalledWith(false);
    expect(hasLabel('커뮤니티 메뉴')).toBe(true);
    await chooseSubNav('profile');
    expect(shown('section-profile')).toBe(true);
    expect(subpage).toHaveBeenLastCalledWith(false);
    expect(hasLabel('커뮤니티 메뉴')).toBe(true);
  });

  test('the menu pages have no back button of their own, since the sub navigation is how you move between them', async () => {
    await render();
    for (const key of ['explore', 'messages', 'profile']) {
      await chooseSubNav(key);
      expect(
        tree.root.findAll(node =>
          String(node.props?.accessibilityLabel ?? '').endsWith('에서 뒤로'),
        ),
      ).toHaveLength(0);
    }
  });

  test('the title of a menu page lines up with the content, not with a back button', async () => {
    await render();
    await chooseSubNav('explore');
    const header = tree.root.findAllByProps({
      testID: 'community-explore-header',
    })[0];
    expect(StyleSheet.flatten(header.props.style).paddingHorizontal).toBe(20);
  });

  test('the system back button still returns from a menu page to the feed, with both bars', async () => {
    await render();
    await chooseSubNav('explore');
    await systemBack();
    expect(shown('section-explore')).toBe(false);
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

  test.each(['community-feed', 'community-explore'])(
    '%s hides its header on descent and brings it back on ascent',
    async id => {
      await render();
      if (id === 'community-explore') await chooseSubNav('explore');
      const scroll = tree.root
        .findAllByType(ScrollView)
        .find(node => node.props.testID === id)!;
      const header = () =>
        tree.root.findAllByProps({ testID: `${id}-header` })[0];
      const move = (y: number) =>
        act(() =>
          scroll.props.onScroll({
            nativeEvent: {
              contentOffset: { y },
              contentSize: { height: 1200 },
              layoutMeasurement: { height: 600 },
            },
          }),
        );
      expect(header().props.accessibilityElementsHidden).toBe(false);
      await move(100);
      expect(header().props.accessibilityElementsHidden).toBe(true);
      await move(130);
      await move(125);
      expect(header().props.pointerEvents).toBe('none');
      await move(105);
      expect(header().props.accessibilityElementsHidden).toBe(false);
      await move(170);
      await move(-15);
      expect(header().props.accessibilityElementsHidden).toBe(false);
    },
  );

  test('the runner search is opened from the explore page and goes back to it', async () => {
    await render();
    await chooseSubNav('explore');
    await press('러너 검색');
    // 위에 쌓인 화면은 뒤로 가기 버튼이 있다
    expect(hasLabel('러너 검색에서 뒤로')).toBe(true);
    expect(shown('section-explore')).toBe(true);
    expect(subpage).toHaveBeenLastCalledWith(true);
    await press('러너 검색에서 뒤로');
    expect(shown('section-explore')).toBe(true);
    expect(hasLabel('커뮤니티 메뉴')).toBe(true);
    expect(subpage).toHaveBeenLastCalledWith(false);
  });

  test('the page is not cut off above the bars: the layer fills the whole screen, with no padding that would end it early', async () => {
    await render();
    await chooseSubNav('profile');
    let layer = tree.root.findAllByProps({ testID: 'section-profile' })[0]
      .parent;
    while (
      layer &&
      StyleSheet.flatten(layer.props.style)?.position !== 'absolute'
    ) {
      layer = layer.parent;
    }
    const style = StyleSheet.flatten(layer?.props.style);
    expect(style.backgroundColor).toBe(colors.surface);
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
    // 내 프로필 자리에는 뒤로 가기 버튼이 없다
    expect(hasLabel('러너 프로필에서 뒤로')).toBe(false);
    expect(shown('section-profile')).toBe(true);
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

  test('the write button is on the feed, explore and my profile, but not on messages', async () => {
    await render();
    for (const key of ['explore', 'profile']) {
      await chooseSubNav(key);
      expect(hasLabel('글쓰기')).toBe(true);
    }
    await chooseSubNav('messages');
    expect(hasLabel('글쓰기')).toBe(false);
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
        const fab = tree.root.findAllByProps({
          testID: 'community-write-dock',
        })[0];
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

describe('posts I do not want to see', () => {
  // 카드마다 글을 지켜보는데, 이 테스트의 목록은 여러 글이라 빈 구독으로 둔다
  beforeEach(() => mockWatchPost.mockImplementation(() => () => {}));
  const other = {
    ...post,
    post_id: 'other-post',
    uid: 'someone',
    text: '다른 글',
  };
  afterEach(() => {
    mockHomePosts.length = 0;
    mockExplorePosts.length = 0;
    mockHidden.blockedUids = new Set();
    mockHidden.hiddenPostIds = new Set();
  });

  test('a blocked author’s posts leave the already loaded feed and explore lists', async () => {
    mockHomePosts.push(post, other);
    mockExplorePosts.push(post, other);
    mockHidden.blockedUids = new Set(['peer']);
    await render();
    expect(texts()).toContain('다른 글');
    expect(texts()).not.toContain('오늘도 달렸어요');
    await chooseSubNav('explore');
    expect(texts()).toContain('다른 글');
    expect(texts()).not.toContain('오늘도 달렸어요');
  });

  test('a hidden post leaves the feed while other posts by the same author stay', async () => {
    const same = {
      ...post,
      post_id: 'same-author',
      text: '같은 사람의 다른 글',
    };
    mockHomePosts.push(post, same);
    mockHidden.hiddenPostIds = new Set(['post-9']);
    await render();
    expect(texts()).toContain('같은 사람의 다른 글');
    expect(texts()).not.toContain('오늘도 달렸어요');
  });

  test('hiding from a post page goes back to where I was', async () => {
    mockWatchPost.mockImplementation(
      (_id: string, next: (value: unknown) => void) => {
        next(post);
        return () => {};
      },
    );
    await render({ page: 'post', id: 'post-9' });
    await press('게시물 메뉴');
    expect(hasLabel('이 게시물 보지 않음')).toBe(true);
    await press('이 게시물 보지 않음');
    await act(async () => {
      tree.root
        .findAll(node => typeof node.props.onDismiss === 'function')
        .forEach(node => node.props.onDismiss());
    });
    expect(mockAction).toHaveBeenCalledWith('hidePost', { postId: 'post-9' });
    expect(hasLabel('게시물에서 뒤로')).toBe(false);
  });
});

describe('a runner I have blocked', () => {
  const blockedProfile = {
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
    blocked: true,
    run_count: 2,
  };
  test('shows only a way to unblock, with no follow, message, records or posts', async () => {
    mockAction.mockImplementation((action: string) =>
      Promise.resolve(action === 'profile' ? blockedProfile : { posts: [] }),
    );
    await render({ page: 'profile', uid: 'peer' });
    const all = texts();
    expect(all).toContain('차단 해제');
    expect(all).not.toContain('팔로우');
    expect(all).not.toContain('메시지 보내기');
    expect(all).not.toContain('러닝 발자국');
    expect(all).not.toContain('최근 게시물');
    await act(async () => {
      tree.root.find(node => node.props.label === '차단 해제').props.onPress();
    });
    expect(mockAction).toHaveBeenCalledWith('blockUser', {
      uid: 'peer',
      blocked: false,
    });
  });
});

describe('the profile page', () => {
  const fullProfile = {
    profile: {
      uid: 'peer',
      display_name: '민지',
      user_id: 'minji_run',
      profile_image: null,
      total_km: 3,
      region: '서울',
      follower_count: 2,
      following_count: 7,
      influencer_tier: 'none',
    },
    following: false,
    run_count: 2,
    post_count: 9,
    recent_runs: [
      {
        day: '2026. 11. 2.',
        distance_km: 3,
        duration_sec: 900,
        avg_pace_sec: 300,
        startedAtMs: 2000,
      },
    ],
  };
  const plainTexts = () =>
    tree.root.findAllByType(Text).map(node =>
      ([] as unknown[])
        .concat(node.props.children)
        .filter(part => typeof part === 'string' || typeof part === 'number')
        .join(''),
    );
  const useProfile = (data: object, runs?: () => Promise<unknown>) =>
    mockAction.mockImplementation((action: string) =>
      action === 'profile'
        ? Promise.resolve(data)
        : action === 'profileRuns'
        ? runs?.() ?? Promise.resolve({ runs: [], hasMore: false })
        : Promise.resolve({ posts: [] }),
    );

  test('has the name on top, then a title, then the place, and no old tagline', async () => {
    useProfile(fullProfile);
    await render({ page: 'profile', uid: 'peer' });
    const all = plainTexts();
    expect(all).not.toContain('DALRYO RUNNER');
    expect(all).not.toContain('서울에서 함께 달려요');
    const name = all.indexOf('민지');
    const title = all.indexOf('칭호');
    const place = all.indexOf('서울');
    expect(name).toBeGreaterThanOrEqual(0);
    expect(name).toBeLessThan(title);
    expect(title).toBeLessThan(place);
  });

  test('has posts, followers and following on one line, each word followed by its number', async () => {
    useProfile(fullProfile);
    await render({ page: 'profile', uid: 'peer' });
    const all = plainTexts();
    const fontSize = (value: string) =>
      StyleSheet.flatten(
        tree.root
          .findAllByType(Text)
          .find(node => String(node.props.children) === value)!.props.style,
      ).fontSize;
    const sizes: number[][] = [];
    for (const [word, count] of [
      ['게시물', '9'],
      ['팔로워', '2'],
      ['팔로잉', '7'],
    ]) {
      expect(all[all.indexOf(word) + 1]).toBe(count);
      sizes.push([fontSize(word), fontSize(count)]);
    }
    // 숫자가 글자보다 한 단계 크고, 세 칸의 비율은 모두 같다
    for (const [label, number] of sizes) expect(number).toBeGreaterThan(label);
    expect(new Set(sizes.map(pair => pair.join('/'))).size).toBe(1);
    const row = tree.root.findAll(
      node =>
        typeof node.type === 'string' &&
        node.findAll(inner => inner.props.children === '게시물').length > 0 &&
        node.findAll(inner => inner.props.children === '팔로잉').length > 0,
    );
    const cells = row.at(-1)!.children as Renderer.ReactTestInstance[];
    expect(StyleSheet.flatten(row.at(-1)!.props.style).flexDirection).toBe(
      'row',
    );
    // 세 칸은 폭이 같고(flex 1), 배경 없이 선으로만 나뉜다
    expect(cells).toHaveLength(3);
    for (const cell of cells) {
      expect(StyleSheet.flatten(cell.props.style).flex).toBe(1);
      expect(StyleSheet.flatten(cell.props.style).flexDirection).toBe('row');
    }
    expect(
      StyleSheet.flatten(row.at(-1)!.props.style).backgroundColor,
    ).toBeUndefined();
  });

  test('the post count falls back to the loaded posts until the server sends it', async () => {
    const older = { ...fullProfile, post_count: undefined };
    mockAction.mockImplementation((action: string) =>
      Promise.resolve(
        action === 'profile'
          ? older
          : { posts: [post, { ...post, post_id: 'b' }] },
      ),
    );
    await render({ page: 'profile', uid: 'peer' });
    const all = plainTexts();
    expect(all[all.indexOf('게시물') + 1]).toBe('2');
  });

  test('posts are as wide as the sections above them', async () => {
    const mine = { ...post, uid: 'peer' };
    mockAction.mockImplementation((action: string) =>
      Promise.resolve(action === 'profile' ? fullProfile : { posts: [mine] }),
    );
    await render({ page: 'profile', uid: 'peer' });
    const card = tree.root.findByProps({ testID: 'community-post-post-9' });
    expect(
      StyleSheet.flatten(card.props.style).marginHorizontal,
    ).toBeUndefined();
  });

  test('the two-column view keeps the 4:5 workout card whole, top to bottom', async () => {
    const withPhoto = {
      ...post,
      uid: 'peer',
      image_url: 'https://example.test/card.jpg',
    };
    const noPhoto = { ...post, post_id: 'plain', uid: 'peer', image_url: null };
    mockAction.mockImplementation((action: string) =>
      Promise.resolve(
        action === 'profile' ? fullProfile : { posts: [withPhoto, noPhoto] },
      ),
    );
    await render({ page: 'profile', uid: 'peer' });
    await press('게시물 그리드 보기');
    const grid = tree.root.findByProps({ testID: 'profile-posts-grid' });
    const ratios = grid
      .findAll(
        node => StyleSheet.flatten(node.props.style)?.aspectRatio !== undefined,
      )
      .map(node => StyleSheet.flatten(node.props.style).aspectRatio);
    expect(ratios.length).toBeGreaterThan(0);
    for (const ratio of ratios) expect(ratio).toBeCloseTo(0.8);
  });

  test('the running footprint section is gone, and the runs open from the stats', async () => {
    useProfile(fullProfile);
    await render({ page: 'profile', uid: 'peer' });
    expect(plainTexts()).not.toContain('러닝 발자국');
    expect(plainTexts()).not.toContain('누적 거리');
    expect(plainTexts()).toContain('완료한 러닝');
    expect(plainTexts()).not.toContain('3.00km');
    await press('최근 러닝 보기');
    expect(plainTexts()).toContain('3.00km');
  });

  test('scrolling the page closes the runs bubble', async () => {
    useProfile(fullProfile);
    await render({ page: 'profile', uid: 'peer' });
    await press('최근 러닝 보기');
    await act(async () => {
      tree.root
        .findAll(node => typeof node.props.onScrollBeginDrag === 'function')[0]
        .props.onScrollBeginDrag();
    });
    expect(plainTexts()).not.toContain('3.00km');
  });

  test('“자세히 보기” opens the full record, which can load older runs', async () => {
    const page = (start: number, hasMore: boolean) => ({
      runs: [
        {
          day: `2026. 10. ${start}.`,
          distance_km: start,
          duration_sec: 600,
          avg_pace_sec: 300,
          startedAtMs: start * 1000,
        },
      ],
      hasMore,
    });
    const runs = jest
      .fn()
      .mockResolvedValueOnce(page(20, true))
      .mockResolvedValueOnce(page(10, false));
    useProfile(fullProfile, runs);
    await render({ page: 'profile', uid: 'peer' });
    await press('최근 러닝 보기');
    await press('러닝 기록 자세히 보기');
    expect(hasLabel('러닝 기록에서 뒤로')).toBe(true);
    expect(mockAction).toHaveBeenCalledWith('profileRuns', { uid: 'peer' });
    expect(plainTexts()).toContain('20.00km');
    await act(async () => {
      tree.root
        .find(node => node.props.label === '이전 기록 더 보기')
        .props.onPress();
    });
    expect(mockAction).toHaveBeenLastCalledWith('profileRuns', {
      uid: 'peer',
      afterMs: 20000,
    });
    expect(plainTexts()).toContain('10.00km');
    expect(
      tree.root.findAll(node => node.props.label === '이전 기록 더 보기'),
    ).toHaveLength(0);
    await press('러닝 기록에서 뒤로');
    expect(hasLabel('러닝 기록에서 뒤로')).toBe(false);
  });

  test('if the full record cannot be loaded it offers another try', async () => {
    useProfile(fullProfile, () => Promise.reject(new Error('offline')));
    await render({ page: 'profile', uid: 'peer' });
    await press('최근 러닝 보기');
    await press('러닝 기록 자세히 보기');
    expect(plainTexts()).toContain('불러오지 못했어요.');
  });
});

describe('the profile menu', () => {
  const plainTexts = () =>
    tree.root.findAllByType(Text).map(node =>
      ([] as unknown[])
        .concat(node.props.children)
        .filter(part => typeof part === 'string' || typeof part === 'number')
        .join(''),
    );
  const profileData = {
    profile: {
      uid: 'me',
      display_name: '나',
      profile_image: null,
      total_km: 3,
      region: '서울',
      follower_count: 0,
      following_count: 0,
      influencer_tier: 'none',
    },
    following: false,
    run_count: 1,
    recent_runs: [],
  };
  const useData = (data: object) =>
    mockAction.mockImplementation((action: string) =>
      Promise.resolve(
        action === 'profile'
          ? data
          : action === 'profilePosts'
          ? { posts: [] }
          : {},
      ),
    );
  const open = async () => {
    await press('프로필 메뉴');
  };

  test('is a three-dot button in the top right corner of the profile card', async () => {
    useData(profileData);
    await render({ page: 'profile', uid: 'me' });
    expect(hasLabel('프로필 메뉴')).toBe(true);
    expect(tree.root.findAllByType(Modal)).toHaveLength(0);
  });

  describe('on my own profile', () => {
    const mine = {
      ...profileData,
      privacy: { runs_public: true, connections_public: false },
    };
    const onSettings = jest.fn();
    const renderMine = async () => {
      await act(async () => {
        tree = Renderer.create(
          <CommunityScreen
            {...base}
            onProfileSettingsPress={onSettings}
            initialRoute={{ page: 'profile', uid: 'me' }}
            onSubpageChange={subpage}
            onInitialRouteHandled={handled}
          />,
        );
      });
    };
    beforeEach(() => {
      onSettings.mockClear();
      useData(mine);
    });

    test('offers profile settings and the two privacy switches with their current state', async () => {
      await renderMine();
      await open();
      const all = plainTexts();
      expect(all).toEqual(
        expect.arrayContaining([
          '프로필 설정',
          '러닝 기록 공개 · 켜짐',
          '팔로워·팔로잉 공개 · 꺼짐',
        ]),
      );
      expect(all).not.toContain('차단');
    });

    test('profile settings opens the settings on the profile item', async () => {
      await renderMine();
      await open();
      await press('프로필 설정');
      await act(async () => tree.root.findByType(Modal).props.onDismiss());
      expect(onSettings).toHaveBeenCalledTimes(1);
    });

    test('a privacy switch tells the server, and the menu shows the new state next time', async () => {
      await renderMine();
      await open();
      await press('러닝 기록 공개 · 켜짐');
      await act(async () => tree.root.findByType(Modal).props.onDismiss());
      expect(mockAction).toHaveBeenCalledWith('setPrivacy', {
        runsPublic: false,
      });
      await open();
      expect(plainTexts()).toContain('러닝 기록 공개 · 꺼짐');
      await press('팔로워·팔로잉 공개 · 꺼짐');
      await act(async () => tree.root.findByType(Modal).props.onDismiss());
      expect(mockAction).toHaveBeenCalledWith('setPrivacy', {
        connectionsPublic: true,
      });
    });

    test('if the server refuses, the switch goes back', async () => {
      await renderMine();
      mockAction.mockImplementation((action: string) =>
        action === 'setPrivacy'
          ? Promise.reject(new Error('offline'))
          : Promise.resolve(action === 'profile' ? mine : { posts: [] }),
      );
      await open();
      await press('러닝 기록 공개 · 켜짐');
      await act(async () => tree.root.findByType(Modal).props.onDismiss());
      await open();
      expect(plainTexts()).toContain('러닝 기록 공개 · 켜짐');
    });
  });

  describe('on someone else’s profile', () => {
    const other = {
      ...profileData,
      profile: { ...profileData.profile, uid: 'peer', display_name: '민지' },
    };
    let alert: jest.SpyInstance;
    beforeEach(() => {
      alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    });
    afterEach(() => alert.mockRestore());

    test('offers only blocking, not settings or privacy', async () => {
      useData(other);
      await render({ page: 'profile', uid: 'peer' });
      await open();
      const all = plainTexts();
      expect(all).toContain('민지 차단');
      expect(all).not.toContain('프로필 설정');
      expect(all.some(text => text.includes('공개 ·'))).toBe(false);
    });

    test('blocking asks first, and only a confirmed block reaches the server', async () => {
      useData(other);
      await render({ page: 'profile', uid: 'peer' });
      await open();
      await press('민지 차단');
      await act(async () => tree.root.findByType(Modal).props.onDismiss());
      expect(alert.mock.calls[0][0]).toBe('민지님을 차단할까요?');
      expect(mockAction).not.toHaveBeenCalledWith(
        'blockUser',
        expect.anything(),
      );
      const buttons = alert.mock.calls[0][2] as Array<{
        text: string;
        onPress?: () => void;
      }>;
      await act(async () => buttons.find(b => b.text === '차단')!.onPress!());
      expect(mockAction).toHaveBeenCalledWith('blockUser', {
        uid: 'peer',
        blocked: true,
      });
    });

    test('a runner I blocked offers unblocking instead', async () => {
      useData({ ...other, blocked: true });
      await render({ page: 'profile', uid: 'peer' });
      await open();
      expect(plainTexts()).not.toContain('민지 차단');
      await press('차단 해제');
      await act(async () => tree.root.findByType(Modal).props.onDismiss());
      expect(mockAction).toHaveBeenCalledWith('blockUser', {
        uid: 'peer',
        blocked: false,
      });
    });
  });
});

describe('private runs on someone’s profile', () => {
  test('show a lock instead of the count and no way to open the runs', async () => {
    mockAction.mockImplementation((action: string) =>
      Promise.resolve(
        action === 'profile'
          ? {
              profile: {
                uid: 'peer',
                display_name: '민지',
                profile_image: null,
                total_km: 3,
                region: '서울',
                follower_count: 1,
                following_count: 1,
                influencer_tier: 'none',
              },
              following: false,
              run_count: null,
              runs_hidden: true,
              recent_runs: [],
            }
          : { posts: [] },
      ),
    );
    await render({ page: 'profile', uid: 'peer' });
    const all = tree.root
      .findAllByType(Text)
      .map(node => ([] as unknown[]).concat(node.props.children).join(''));
    expect(all).toContain('러닝 기록은 비공개예요');
    expect(hasLabel('최근 러닝 보기')).toBe(false);
  });
});

describe('back buttons on pages that are stacked on top', () => {
  test('someone else’s profile, reached from a post or a link, keeps its back button', async () => {
    await render({ page: 'profile', uid: 'peer' });
    expect(hasLabel('러너 프로필에서 뒤로')).toBe(true);
    expect(shown('section-profile')).toBe(false);
  });

  test('my own profile opened from a link on top of the feed also keeps it, since it is not the menu page', async () => {
    await render({ page: 'profile', uid: 'me' });
    expect(hasLabel('러너 프로필에서 뒤로')).toBe(true);
  });
});
