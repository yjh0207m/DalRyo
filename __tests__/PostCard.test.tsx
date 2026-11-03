import React from 'react';
import { usePostAuthor } from '../src/hooks/usePostAuthor';
jest.mock('../src/hooks/usePostAuthor', () => ({ usePostAuthor: jest.fn() }));
jest.mock('../src/components/character/CharacterView', () => ({
  CharacterView: () => null,
}));
import { Alert, Image, Modal, Text, View as MockView } from 'react-native';
import Renderer, { act } from 'react-test-renderer';
import { PostCard } from '../src/screens/community/CommunityScreen';
import type { SocialPost } from '../src/services/social.service';
const mockAction = jest.fn(),
  mockOpen = jest.fn(),
  mockProfile = jest.fn(),
  mockComments = jest.fn();
jest.mock('../src/services/social.service', () => ({
  myUid: () => 'me',
  socialRequest: (...args: unknown[]) => mockAction(...args),
  watchPost: (_id: string, next: (post: unknown) => void) => {
    mockLivePost = next;
    return () => {};
  },
  watchPostFlags: (_id: string, next: (flags: unknown) => void) => {
    next({ liked: false, saved: false });
    return () => {};
  },
  socialError: (error: Error) => error.message,
}));
jest.mock('../src/hooks/useServerFeed', () => ({ useServerFeed: jest.fn() }));
jest.mock('../src/hooks/useComments', () => ({ useComments: jest.fn() }));
jest.mock('../src/services/media.service', () => ({
  choosePhoto: jest.fn(),
  uploadPhoto: jest.fn(),
}));
jest.mock('../src/services/run.service', () => ({
  fetchRecentRuns: jest.fn(),
}));
jest.mock('../src/services/chat.service', () => ({
  watchConversations: () => () => {},
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
  post_id: 'one',
  uid: 'other',
  author_name: '러너',
  author_image: null,
  author_tier: 'none',
  text: '오늘도 달렸어요',
  image_url: 'https://example.test/photo.jpg',
  visibility: 'public',
  run_id: null,
  distance_km: null,
  avg_pace_sec: null,
  calories: null,
  hashtags: [],
  like_count: 3,
  comment_count: 2,
  createdAtMs: Date.now(),
} satisfies SocialPost;
let tree: Renderer.ReactTestRenderer;
let mockLivePost: (post: unknown) => void;
beforeEach(() => {
  jest.clearAllMocks();
  (usePostAuthor as jest.Mock).mockReturnValue(undefined);
  mockAction.mockResolvedValue({});
});
afterEach(async () => {
  await act(() => tree?.unmount());
});
async function render(value: SocialPost = post) {
  await act(async () => {
    tree = Renderer.create(
      <PostCard
        post={value}
        onOpen={mockOpen}
        onComments={mockComments}
        onProfile={mockProfile}
      />,
    );
  });
}
async function press(label: string) {
  await act(async () => {
    await tree.root
      .findAll(
        node =>
          typeof node.props.onPress === 'function' &&
          typeof node.type === 'function' &&
          node.type.name === 'Pressable',
      )
      .find(node => node.props.accessibilityLabel === label)!
      .props.onPress();
  });
}
test('the photo feed preserves real media and profile/comment navigation', async () => {
  await render();
  expect(tree.root.findByType(Image).props.source).toEqual({
    uri: post.image_url,
  });
  await press('러너 프로필');
  await press('댓글 보기');
  expect(mockProfile).toHaveBeenCalledTimes(1);
  expect(mockComments).toHaveBeenCalledTimes(1);
  expect(mockOpen).not.toHaveBeenCalled();
});

test('old posts use the current author photo, including a removed photo', async () => {
  (usePostAuthor as jest.Mock).mockReturnValue({
    display_name: '새 닉네임',
    profile_image: 'https://example.test/current.jpg',
  });
  await render({ ...post, author_image: 'https://example.test/old.jpg' });
  expect(
    tree.root.findAllByType(Image).map(image => image.props.source.uri),
  ).toContain('https://example.test/current.jpg');
  expect(JSON.stringify(tree.toJSON())).not.toContain(
    'https://example.test/old.jpg',
  );
  await press('새 닉네임 프로필');
  (usePostAuthor as jest.Mock).mockReturnValue({
    display_name: '새 닉네임',
    profile_image: null,
  });
  await act(() =>
    tree.update(
      <PostCard
        post={post}
        onOpen={mockOpen}
        onComments={mockComments}
        onProfile={mockProfile}
      />,
    ),
  );
  expect(
    tree.root.findAllByType(Image).map(image => image.props.source.uri),
  ).not.toContain('https://example.test/current.jpg');
});
test('the reorganized action row keeps desired-state like and bookmark mutations', async () => {
  await render();
  await press('응원');
  await press('게시물 저장');
  await press('저장 취소');
  expect(mockAction.mock.calls).toEqual([
    ['like', { postId: 'one', active: true }],
    ['bookmark', { postId: 'one', active: true }],
    ['bookmark', { postId: 'one', active: false }],
  ]);
});
test('private posts offer no public sharing action and run tiles use saved metrics', async () => {
  await render({
    ...post,
    visibility: 'private',
    image_url: null,
    run_id: 'run-one',
    distance_km: 3.25,
    avg_pace_sec: 360,
    calories: 200,
  });
  expect(
    tree.root
      .findAll(
        node =>
          typeof node.props.onPress === 'function' &&
          typeof node.type === 'function' &&
          node.type.name === 'Pressable',
      )
      .some(node => node.props.accessibilityLabel === '게시물 공유'),
  ).toBe(false);
  expect(JSON.stringify(tree.toJSON())).toContain('3.25');
  expect(JSON.stringify(tree.toJSON())).toContain('200');
});

describe('the post menu', () => {
  const texts = () =>
    tree.root
      .findAllByType(Text)
      .map(node => ([] as unknown[]).concat(node.props.children).join(''));
  const onEdit = jest.fn();
  const onDeleted = jest.fn();
  async function renderFull(value: SocialPost = post) {
    await act(async () => {
      tree = Renderer.create(
        <PostCard
          post={value}
          onOpen={mockOpen}
          onComments={mockComments}
          onProfile={mockProfile}
          onEdit={onEdit}
          onDeleted={onDeleted}
        />,
      );
    });
  }
  const mine = { ...post, uid: 'me' };
  // 메뉴에서 고르면 메뉴가 닫힌 뒤(iOS) 실행된다
  const choose = async (label: string) => {
    await press(label);
    await act(async () => tree.root.findByType(Modal).props.onDismiss());
  };
  let alert: jest.SpyInstance;
  beforeEach(() => {
    alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });
  afterEach(() => alert.mockRestore());
  const confirm = async (text: string) => {
    const buttons = alert.mock.calls.at(-1)![2] as Array<{
      text: string;
      onPress?: () => void;
    }>;
    await act(async () => buttons.find(b => b.text === text)!.onPress!());
  };

  test('is closed until asked for, and shows no pop-up alert list', async () => {
    await renderFull();
    expect(tree.root.findAllByType(Modal)).toHaveLength(0);
    await press('게시물 메뉴');
    expect(tree.root.findByType(Modal).props.visible).toBe(true);
    expect(alert).not.toHaveBeenCalled();
  });

  test('my post offers edit and delete, and nothing about hiding or blocking', async () => {
    await renderFull(mine);
    await press('게시물 메뉴');
    expect(texts()).toEqual(expect.arrayContaining(['수정', '삭제', '취소']));
    expect(texts()).not.toContain('이 게시물 보지 않음');
    expect(texts().some(text => text.endsWith('차단'))).toBe(false);
  });

  test('editing from the menu runs the edit action', async () => {
    await renderFull(mine);
    await press('게시물 메뉴');
    await choose('게시물 수정');
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  test('where editing is not possible, my post only offers delete', async () => {
    await render(mine);
    await press('게시물 메뉴');
    expect(texts()).toContain('삭제');
    expect(texts()).not.toContain('수정');
  });

  test('deleting from the menu asks first', async () => {
    await renderFull(mine);
    await press('게시물 메뉴');
    await choose('게시물 삭제');
    expect(alert.mock.calls[0][0]).toBe('게시물을 삭제할까요?');
    expect(mockAction).not.toHaveBeenCalled();
    await confirm('삭제');
    expect(mockAction).toHaveBeenCalledWith('deletePost', { postId: 'one' });
    expect(onDeleted).toHaveBeenCalledTimes(1);
  });

  test('someone else’s post offers hiding it and blocking the author, not edit or delete', async () => {
    await renderFull();
    await press('게시물 메뉴');
    expect(texts()).toEqual(
      expect.arrayContaining(['이 게시물 보지 않음', '러너 차단', '취소']),
    );
    expect(texts()).not.toContain('수정');
    expect(texts()).not.toContain('삭제');
  });

  test('hiding removes the post right away and tells the server', async () => {
    await renderFull();
    await press('게시물 메뉴');
    await choose('이 게시물 보지 않음');
    expect(tree.toJSON()).toBeNull();
    expect(onDeleted).toHaveBeenCalledTimes(1);
    expect(mockAction).toHaveBeenCalledWith('hidePost', { postId: 'one' });
  });

  test('if hiding fails the post comes back', async () => {
    mockAction.mockRejectedValue(new Error('offline'));
    await renderFull();
    await press('게시물 메뉴');
    await choose('이 게시물 보지 않음');
    expect(tree.toJSON()).not.toBeNull();
  });

  test('blocking asks first and explains what happens, and cancelling does nothing', async () => {
    await renderFull();
    await press('게시물 메뉴');
    await choose('러너 차단');
    expect(alert.mock.calls[0][0]).toBe('러너님을 차단할까요?');
    expect(alert.mock.calls[0][1]).toContain('설정에서 해제');
    expect(mockAction).not.toHaveBeenCalled();
    expect(tree.toJSON()).not.toBeNull();
  });

  test('confirming a block removes the post and tells the server who', async () => {
    await renderFull();
    await press('게시물 메뉴');
    await choose('러너 차단');
    await confirm('차단');
    expect(tree.toJSON()).toBeNull();
    expect(mockAction).toHaveBeenCalledWith('blockUser', {
      uid: 'other',
      blocked: true,
    });
  });

  test('if blocking fails the post comes back', async () => {
    mockAction.mockRejectedValue(new Error('offline'));
    await renderFull();
    await press('게시물 메뉴');
    await choose('러너 차단');
    await confirm('차단');
    expect(tree.toJSON()).not.toBeNull();
  });
});

describe('a card keeps itself up to date', () => {
  const texts = () =>
    tree.root
      .findAllByType(Text)
      .map(node => ([] as unknown[]).concat(node.props.children).join(''));

  test('counts follow the post even though the feed list is not live', async () => {
    await render();
    expect(texts()).toContain('댓글 2개 모두 보기');
    await act(async () =>
      mockLivePost({ ...post, like_count: 9, comment_count: 1 }),
    );
    expect(texts()).toContain('응원 9개');
    expect(texts()).toContain('댓글 1개 모두 보기');
  });

  test('a post deleted elsewhere disappears from the list', async () => {
    await render();
    await act(async () => mockLivePost(null));
    expect(tree.toJSON()).toBeNull();
  });
});
