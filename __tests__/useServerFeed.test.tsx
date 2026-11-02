import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { useServerFeed, type ServerFeed } from '../src/hooks/useServerFeed';

const mockRequest = jest.fn();
jest.mock('../src/services/social.service', () => ({
  socialRequest: (...args: unknown[]) => mockRequest(...args),
}));

const post = (id: string) => ({ post_id: id, createdAtMs: 1 });
let feed: ReturnType<typeof useServerFeed>;
let action: ServerFeed = 'exploreFeed';
let tree: Renderer.ReactTestRenderer;
function Probe() {
  feed = useServerFeed(action);
  return null;
}
const ids = () => feed.posts.map((p: { post_id: string }) => p.post_id);
async function mount() {
  await act(async () => {
    tree = Renderer.create(<Probe />);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  action = 'exploreFeed';
});
afterEach(async () => {
  await act(async () => tree.unmount());
});

test('loads the first batch from the server and keeps the server order', async () => {
  mockRequest.mockResolvedValue({
    posts: [post('c'), post('a'), post('b')],
    hasMore: true,
  });
  await mount();
  expect(mockRequest).toHaveBeenCalledWith('exploreFeed', {
    offset: 0,
    seed: expect.any(Number),
  });
  // 시간순으로 다시 정렬하지 않는다
  expect(ids()).toEqual(['c', 'a', 'b']);
  expect(feed.status).toBe('success');
  expect(feed.more).toBe(true);
});

test('loading more skips what it already has and appends the next batch after it', async () => {
  mockRequest.mockResolvedValueOnce({
    posts: [post('a'), post('b')],
    hasMore: true,
  });
  await mount();
  mockRequest.mockResolvedValueOnce({
    posts: [post('b'), post('c')],
    hasMore: false,
  });
  await act(async () => feed.loadMore());
  expect(mockRequest).toHaveBeenLastCalledWith('exploreFeed', {
    offset: 2,
    seed: expect.any(Number),
  });
  expect(ids()).toEqual(['a', 'b', 'c']);
  expect(feed.more).toBe(false);
});

test('only one load-more runs at a time', async () => {
  mockRequest.mockResolvedValueOnce({ posts: [post('a')], hasMore: true });
  await mount();
  let release!: (value: unknown) => void;
  mockRequest.mockReturnValueOnce(new Promise(resolve => (release = resolve)));
  await act(async () => {
    feed.loadMore();
    feed.loadMore();
  });
  expect(mockRequest).toHaveBeenCalledTimes(2);
  await act(async () => release({ posts: [post('b')], hasMore: false }));
  expect(ids()).toEqual(['a', 'b']);
});

test('a failure shows the error state, and refreshing tries again from the start', async () => {
  mockRequest.mockRejectedValueOnce(new Error('offline'));
  await mount();
  expect(feed.status).toBe('error');
  mockRequest.mockResolvedValueOnce({ posts: [post('a')], hasMore: false });
  await act(async () => feed.refresh());
  expect(mockRequest).toHaveBeenLastCalledWith('exploreFeed', {
    offset: 0,
    seed: expect.any(Number),
  });
  expect(feed.status).toBe('success');
  expect(ids()).toEqual(['a']);
});

test('a failed load-more keeps the list and can be retried', async () => {
  mockRequest.mockResolvedValueOnce({ posts: [post('a')], hasMore: true });
  await mount();
  mockRequest.mockRejectedValueOnce(new Error('offline'));
  await act(async () => feed.loadMore());
  expect(feed.moreError).toBe(true);
  expect(ids()).toEqual(['a']);
  mockRequest.mockResolvedValueOnce({ posts: [post('b')], hasMore: false });
  await act(async () => feed.loadMore());
  expect(feed.moreError).toBe(false);
  expect(ids()).toEqual(['a', 'b']);
});

test('the home feed asks for its own list', async () => {
  action = 'homeFeed';
  mockRequest.mockResolvedValue({ posts: [post('a')], hasMore: false });
  await mount();
  expect(mockRequest).toHaveBeenCalledWith('homeFeed', {
    offset: 0,
    seed: expect.any(Number),
  });
});

test('loading more keeps the seed of the current refresh, and a refresh picks a new one', async () => {
  const seeds = () => mockRequest.mock.calls.map(call => call[1].seed);
  mockRequest.mockResolvedValue({ posts: [post('a')], hasMore: true });
  await mount();
  await act(async () => feed.loadMore());
  const [first, second] = seeds();
  // 더 보기는 같은 seed라서 서버가 같은 순서로 이어서 준다
  expect(second).toBe(first);
  const random = jest.spyOn(Math, 'random').mockReturnValue(0.123);
  await act(async () => feed.refresh());
  random.mockRestore();
  expect(seeds().at(-1)).toBe(Math.floor(0.123 * 2 ** 31));
});
