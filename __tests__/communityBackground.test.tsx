import React from 'react';
jest.mock('../src/components/character/CharacterView', () => ({CharacterView: () => null}));
import { Alert, TextInput, View as MockView } from 'react-native';
import Renderer, { act } from 'react-test-renderer';
import {
  Composer,
  PostCard,
  ProfilePage,
} from '../src/screens/community/CommunityScreen';
import {
  resetBackgroundTasks,
  useBackgroundToasts,
  type BackgroundToast,
} from '../src/services/backgroundTask.service';
import type { SocialPost } from '../src/services/social.service';

const mockAction = jest.fn();
const mockUpload = jest.fn();
jest.mock('../src/services/social.service', () => ({
  myUid: () => 'me',
  newSocialId: () => 'new-post',
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
  uploadPhoto: (...args: unknown[]) => mockUpload(...args),
}));
jest.mock('../src/services/run.service', () => ({
  fetchRecentRuns: () => Promise.resolve([]),
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
  uid: 'me',
  author_name: '나',
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
  like_count: 0,
  comment_count: 0,
  createdAtMs: Date.now(),
} satisfies SocialPost;

let tree: Renderer.ReactTestRenderer;
let probe: Renderer.ReactTestRenderer;
let toasts: BackgroundToast[] = [];
let alert: jest.SpyInstance;
function Probe() {
  toasts = useBackgroundToasts();
  return null;
}
// 서버가 아직 답하지 않은 요청을 만들고, 원하는 때 끝낸다
function pending() {
  let resolve!: (value: unknown) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
const pressable = (root: Renderer.ReactTestInstance, label: string) =>
  root.findAll(
    node =>
      typeof node.props.onPress === 'function' &&
      node.props.accessibilityLabel === label,
  )[0];
const buttonByText = (label: string) => {
  const text = tree.root.findAll(node => node.props.children === label)[0];
  let node: Renderer.ReactTestInstance | null = text;
  while (node && typeof node.props.onPress !== 'function') node = node.parent;
  return node!;
};
const selected = (label: string) =>
  pressable(tree.root, label).props.accessibilityState.selected;

beforeEach(async () => {
  jest.clearAllMocks();
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  mockAction.mockResolvedValue({});
  mockUpload.mockResolvedValue({
    url: 'https://storage.example/p.jpg',
    discard: jest.fn(),
  });
  await act(async () => {
    probe = Renderer.create(<Probe />);
  });
});
afterEach(async () => {
  alert.mockRestore();
  await act(async () => {
    resetBackgroundTasks();
    tree?.unmount();
    probe.unmount();
  });
});

describe('like and bookmark', () => {
  const render = () =>
    act(async () => {
      tree = Renderer.create(
        <PostCard
          post={post}
          onOpen={jest.fn()}
          onComments={jest.fn()}
          onProfile={jest.fn()}
        />,
      );
    });

  test('the button flips right away without waiting, and rapid taps send a single request', async () => {
    const request = pending();
    mockAction.mockReturnValue(request.promise);
    await render();
    await act(async () => pressable(tree.root, '응원').props.onPress());
    expect(selected('응원')).toBe(true);
    expect(pressable(tree.root, '응원').props.disabled).toBeFalsy();
    await act(async () => pressable(tree.root, '응원').props.onPress());
    expect(mockAction).toHaveBeenCalledTimes(1);
    expect(toasts).toEqual([]);
    await act(async () => request.resolve({}));
    expect(selected('응원')).toBe(true);
    expect(toasts).toEqual([]);
  });

  test('a failed request puts the button back and reports it in the popup', async () => {
    const request = pending();
    mockAction.mockReturnValue(request.promise);
    await render();
    await act(async () => pressable(tree.root, '게시물 저장').props.onPress());
    expect(selected('저장 취소')).toBe(true);
    await act(async () => request.reject(new Error('네트워크 오류')));
    expect(selected('게시물 저장')).toBe(false);
    expect(toasts).toMatchObject([
      {
        kind: 'failed',
        message: '저장을 처리하지 못했어요',
        detail: '네트워크 오류',
        retryable: false,
      },
    ]);
    // 되돌린 뒤에는 다시 누를 수 있다
    mockAction.mockResolvedValue({});
    await act(async () => pressable(tree.root, '게시물 저장').props.onPress());
    expect(selected('저장 취소')).toBe(true);
  });
});

describe('deleting a post', () => {
  test('after the confirmation it goes back at once while the server deletes in the background', async () => {
    const request = pending();
    const onDeleted = jest.fn();
    mockAction.mockReturnValue(request.promise);
    await act(async () => {
      tree = Renderer.create(
        <PostCard
          post={post}
          detail
          onOpen={jest.fn()}
          onComments={jest.fn()}
          onProfile={jest.fn()}
          onDeleted={onDeleted}
        />,
      );
    });
    await act(async () => pressable(tree.root, '게시물 삭제').props.onPress());
    const buttons = alert.mock.calls[0][2] as Array<{
      text: string;
      onPress?: () => void;
    }>;
    await act(async () =>
      buttons.find(button => button.text === '삭제')!.onPress!(),
    );
    expect(onDeleted).toHaveBeenCalledTimes(1);
    expect(mockAction).toHaveBeenCalledWith('deletePost', { postId: 'one' });
    expect(toasts).toMatchObject([
      { kind: 'running', message: '게시물 삭제 중' },
    ]);
    await act(async () => request.resolve({}));
    expect(toasts).toMatchObject([
      { kind: 'done', message: '게시물을 삭제했어요' },
    ]);
  });

  test('a failed delete keeps a retry popup instead of leaving the user waiting', async () => {
    mockAction.mockRejectedValue(new Error('권한이 없어요'));
    await act(async () => {
      tree = Renderer.create(
        <PostCard
          post={post}
          detail
          onOpen={jest.fn()}
          onComments={jest.fn()}
          onProfile={jest.fn()}
          onDeleted={jest.fn()}
        />,
      );
    });
    await act(async () => pressable(tree.root, '게시물 삭제').props.onPress());
    const buttons = alert.mock.calls[0][2] as Array<{
      text: string;
      onPress?: () => void;
    }>;
    await act(async () =>
      buttons.find(button => button.text === '삭제')!.onPress!(),
    );
    expect(toasts).toMatchObject([
      {
        kind: 'failed',
        message: '게시물을 삭제하지 못했어요',
        detail: '권한이 없어요',
        retryable: true,
      },
    ]);
  });
});

describe('writing a post', () => {
  const type = (value: string) =>
    act(async () => tree.root.findByType(TextInput).props.onChangeText(value));

  test('saving leaves the screen immediately and the upload and request continue in the background', async () => {
    const request = pending();
    const onSaved = jest.fn();
    mockAction.mockReturnValue(request.promise);
    await act(async () => {
      tree = Renderer.create(<Composer onBack={jest.fn()} onSaved={onSaved} />);
    });
    await type('  오늘도 완주! #오운완  ');
    await act(async () => buttonByText('게시물 올리기').props.onPress());
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(mockAction).toHaveBeenCalledWith('createPost', {
      postId: 'new-post',
      text: '오늘도 완주! #오운완',
      visibility: 'public',
      imageUrl: null,
      runId: null,
    });
    expect(toasts).toMatchObject([
      { kind: 'running', message: '게시물 올리는 중' },
    ]);
    await act(async () => request.resolve({}));
    expect(toasts).toMatchObject([
      { kind: 'done', message: '게시물을 올렸어요' },
    ]);
  });

  test('an empty post is rejected on the screen without starting anything', async () => {
    const onSaved = jest.fn();
    await act(async () => {
      tree = Renderer.create(<Composer onBack={jest.fn()} onSaved={onSaved} />);
    });
    await act(async () => buttonByText('게시물 올리기').props.onPress());
    expect(onSaved).not.toHaveBeenCalled();
    expect(mockAction).not.toHaveBeenCalled();
    expect(toasts).toEqual([]);
    expect(JSON.stringify(tree.toJSON())).toContain(
      '내용이나 사진, 달리기 기록을 추가해 주세요.',
    );
  });

  test('editing also saves in the background', async () => {
    const onSaved = jest.fn();
    await act(async () => {
      tree = Renderer.create(
        <Composer post={post} onBack={jest.fn()} onSaved={onSaved} />,
      );
    });
    await type('수정한 내용');
    await act(async () => buttonByText('수정 저장').props.onPress());
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(mockAction).toHaveBeenCalledWith('editPost', {
      postId: 'one',
      text: '수정한 내용',
      visibility: 'public',
    });
    expect(toasts).toMatchObject([
      { kind: 'done', message: '게시물을 수정했어요' },
    ]);
  });
});

describe('follow', () => {
  const profile = {
    uid: 'friend',
    display_name: '친구',
    profile_image: null,
    total_km: 10,
    region: '서울',
    follower_count: 1,
    following_count: 2,
    influencer_tier: 'none',
  };
  const respond = (follow: () => Promise<unknown>) =>
    mockAction.mockImplementation((action: string) =>
      action === 'profile'
        ? Promise.resolve({ profile, following: false, friend: false })
        : action === 'profilePosts'
        ? Promise.resolve({ posts: [] })
        : follow(),
    );
  const render = () =>
    act(async () => {
      tree = Renderer.create(
        <ProfilePage
          uid="friend"
          onBack={jest.fn()}
          onPost={jest.fn()}
          onMessage={jest.fn()}
          onComments={jest.fn()}
        />,
      );
    });

  test('the button changes immediately and the profile reloads once the server confirms', async () => {
    const request = pending();
    respond(() => request.promise);
    await render();
    await act(async () => buttonByText('팔로우').props.onPress());
    expect(JSON.stringify(tree.toJSON())).toContain('팔로잉');
    await act(async () => buttonByText('팔로잉').props.onPress());
    expect(
      mockAction.mock.calls.filter(call => call[0] === 'follow'),
    ).toHaveLength(1);
    expect(mockAction).toHaveBeenCalledWith('follow', {
      uid: 'friend',
      following: true,
    });
    const loads = mockAction.mock.calls.filter(
      call => call[0] === 'profile',
    ).length;
    await act(async () => request.resolve({}));
    expect(
      mockAction.mock.calls.filter(call => call[0] === 'profile').length,
    ).toBe(loads + 1);
  });

  test('a failed follow flips the button back and says so', async () => {
    const request = pending();
    respond(() => request.promise);
    await render();
    await act(async () => buttonByText('팔로우').props.onPress());
    await act(async () => request.reject(new Error('연결을 확인해 주세요')));
    expect(buttonByText('팔로우')).toBeDefined();
    expect(toasts).toMatchObject([
      {
        kind: 'failed',
        message: '팔로우하지 못했어요',
        detail: '연결을 확인해 주세요',
      },
    ]);
  });
});
