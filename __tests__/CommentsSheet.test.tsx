import React from 'react';
import { Animated, Modal, TextInput, View as MockView } from 'react-native';
import Renderer, { act } from 'react-test-renderer';
import { CommentsSheet } from '../src/screens/community/CommentsSheet';
import { CommunityScreen } from '../src/screens/community/CommunityScreen';
import type { SocialPost, SocialComment } from '../src/services/social.service';
const mockAction = jest.fn(),
  mockClose = jest.fn(),
  mockProfile = jest.fn(),
  mockLoadMore = jest.fn();
let mockNextPost: (post: SocialPost | null) => void;
const mockPost = {
  post_id: 'post-one',
  uid: 'author',
  author_name: '러너',
  author_image: null,
  author_tier: 'none',
  text: '오늘의 달리기',
  image_url: null,
  visibility: 'public',
  run_id: null,
  distance_km: null,
  avg_pace_sec: null,
  calories: null,
  hashtags: [],
  like_count: 0,
  comment_count: 2,
  createdAtMs: 1000,
} as SocialPost;
const mockComments = [
  {
    comment_id: 'other',
    uid: 'peer',
    author_name: '친구',
    author_image: null,
    text: '잘 달렸어요',
    parent_id: null,
    deleted: false,
    createdAtMs: 1000,
  },
  {
    comment_id: 'mine',
    uid: 'me',
    author_name: '나',
    author_image: null,
    text: '감사해요',
    parent_id: 'other',
    deleted: false,
    createdAtMs: 2000,
  },
] as SocialComment[];
jest.mock('../src/services/social.service', () => ({
  myUid: () => 'me',
  newSocialId: () => 'stable-comment',
  socialError: (e: Error) => e.message,
  socialRequest: (...args: unknown[]) => mockAction(...args),
  watchPost: (_id: string, next: typeof mockNextPost) => {
    mockNextPost = next;
    next(mockPost);
    return () => {};
  },
  watchPostFlags: (_id: string, next: (v: unknown) => void) => {
    next({ liked: false, saved: false });
    return () => {};
  },
}));
jest.mock('../src/hooks/useComments', () => ({
  useComments: () => ({
    comments: mockComments,
    status: 'success',
    more: true,
    pending: false,
    error: false,
    loadMore: mockLoadMore,
  }),
}));
jest.mock('../src/hooks/useSocialFeed', () => ({
  useSocialFeed: () => ({
    posts: [mockPost],
    status: 'success',
    more: false,
    refresh: jest.fn(),
  }),
}));
jest.mock('../src/services/chat.service', () => ({
  watchConversations: () => () => {},
}));
jest.mock('../src/services/media.service', () => ({
  choosePhoto: jest.fn(),
  uploadPhoto: jest.fn(),
}));
jest.mock('../src/services/run.service', () => ({
  fetchRecentRuns: jest.fn(),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: MockView,
  useSafeAreaInsets: () => ({ top: 24, bottom: 16 }),
}));
jest.mock(
  'lucide-react-native',
  () => new Proxy({}, { get: () => () => null }),
);
let tree: Renderer.ReactTestRenderer;
beforeEach(() => {
  jest.clearAllMocks();
  mockAction.mockResolvedValue({});
  jest
    .spyOn(Animated, 'parallel')
    .mockImplementation(() => ({
      start: (next?: (r: { finished: boolean }) => void) =>
        next?.({ finished: true }),
      stop: () => {},
      reset: () => {},
    }));
});
afterEach(async () => {
  await act(() => tree?.unmount());
  jest.restoreAllMocks();
});
async function render() {
  await act(async () => {
    tree = Renderer.create(
      <CommentsSheet
        postId="post-one"
        onClose={mockClose}
        onProfile={mockProfile}
      />,
    );
  });
}
function buttons(label: string) {
  return tree.root.findAll(
    n =>
      typeof n.type === 'function' &&
      n.type.name === 'Pressable' &&
      n.props.accessibilityLabel === label,
  );
}
async function press(label: string) {
  await act(async () => {
    await buttons(label)[0].props.onPress();
  });
}
async function type(value: string) {
  await act(() => tree.root.findByType(TextInput).props.onChangeText(value));
}

test('feed removes stories, retains writing and opens comments over the existing feed', async () => {
  await act(async () => {
    tree = Renderer.create(
      <CommunityScreen
        onNotificationPress={jest.fn()}
        onSettingsPress={jest.fn()}
      />,
    );
  });
  expect(buttons('내 러닝 이야기 작성')).toHaveLength(0);
  expect(buttons('글쓰기')).toHaveLength(1);
  expect(tree.root.findAllByType(Modal)).toHaveLength(0);
  await press('댓글 보기');
  expect(tree.root.findAllByType(Modal)).toHaveLength(1);
  expect(buttons('글쓰기')).toHaveLength(1);
  await act(() => tree.root.findByType(Modal).props.onRequestClose());
  expect(tree.root.findAllByType(Modal)).toHaveLength(0);
  expect(buttons('댓글 보기')).toHaveLength(1);
});
test('failed send keeps the draft and reuses the comment id on retry', async () => {
  await render();
  await type('멋져요');
  mockAction.mockRejectedValueOnce(new Error('offline'));
  await press('댓글 전송');
  expect(tree.root.findByType(TextInput).props.value).toBe('멋져요');
  await press('댓글 전송');
  expect(mockAction.mock.calls).toEqual([
    [
      'comment',
      {
        postId: 'post-one',
        commentId: 'stable-comment',
        text: '멋져요',
        parentId: null,
      },
    ],
    [
      'comment',
      {
        postId: 'post-one',
        commentId: 'stable-comment',
        text: '멋져요',
        parentId: null,
      },
    ],
  ]);
  expect(tree.root.findByType(TextInput).props.value).toBe('');
});
test('reply and cancel use the intended parent without changing the draft', async () => {
  await render();
  await press('친구에게 답글 쓰기');
  await type('고마워요');
  await press('댓글 전송');
  expect(mockAction).toHaveBeenLastCalledWith(
    'comment',
    expect.objectContaining({ parentId: 'other' }),
  );
  await press('친구에게 답글 쓰기');
  await type('다시 달려요');
  await press('답글 취소');
  expect(tree.root.findByType(TextInput).props.value).toBe('다시 달려요');
  await press('댓글 전송');
  expect(mockAction).toHaveBeenLastCalledWith(
    'comment',
    expect.objectContaining({ parentId: null }),
  );
});
test('repeated send presses while pending issue one mutation', async () => {
  await render();
  await type('응원해요');
  let finish!: (value: unknown) => void;
  mockAction.mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  const send = buttons('댓글 전송')[0].props.onPress;
  await act(() => {
    send();
    send();
  });
  expect(mockAction).toHaveBeenCalledTimes(1);
  expect(buttons('댓글 전송')[0].props.disabled).toBe(true);
  await act(async () => {
    finish({});
  });
});
test('a removed post disables commenting, keeps draft and shows no stale comments', async () => {
  await render();
  await type('초안');
  await act(() => mockNextPost(null));
  expect(buttons('댓글 전송')[0].props.disabled).toBe(true);
  expect(tree.root.findByType(TextInput).props.value).toBe('초안');
  expect(buttons('친구에게 답글 쓰기')).toHaveLength(0);
  await press('댓글 전송');
  expect(mockAction).not.toHaveBeenCalled();
});
test('only own comments expose deletion and older comments retain pagination', async () => {
  await render();
  expect(buttons('댓글 삭제')).toHaveLength(1);
  await act(() =>
    tree.root.findByProps({ label: '이전 댓글 더 보기' }).props.onPress(),
  );
  expect(mockLoadMore).toHaveBeenCalledTimes(1);
});
test('profile navigation dismisses the sheet before opening the profile', async () => {
  await render();
  const order: string[] = [];
  mockClose.mockImplementation(() => order.push('close'));
  mockProfile.mockImplementation(() => order.push('profile'));
  await press('친구 프로필');
  expect(mockProfile).toHaveBeenCalledWith('peer');
  expect(order).toEqual(['close', 'profile']);
});
