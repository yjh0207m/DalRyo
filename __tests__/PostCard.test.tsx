import React from 'react';
import { Image, View as MockView } from 'react-native';
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
  watchPostFlags: (_id: string, next: (flags: unknown) => void) => {
    next({ liked: false, saved: false });
    return () => {};
  },
  socialError: (error: Error) => error.message,
}));
jest.mock('../src/hooks/useSocialFeed', () => ({ useSocialFeed: jest.fn() }));
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
beforeEach(() => {
  jest.clearAllMocks();
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
