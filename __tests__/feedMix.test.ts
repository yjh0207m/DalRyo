import {
  HOME_RECOMMEND_EVERY,
  mixHome,
  rankByRelation,
  recommendations,
  seededShuffle,
  type FeedPost,
} from '../functions/src/explore';

const post = (id: string, extra: Partial<FeedPost> = {}): FeedPost => ({
  post_id: id,
  uid: `author-${id}`,
  createdAtMs: 1,
  visibility: 'public',
  ...extra,
});
const ids = (posts: FeedPost[]) => posts.map(p => p.post_id);
const options = (following: string[] = [], seed = 1) => ({
  uid: 'me',
  following: new Set(following),
  seed,
});

describe('seeded shuffle', () => {
  const items = Array.from({ length: 20 }, (_, i) => i);

  test('gives the same order for the same seed', () => {
    expect(seededShuffle(items, 42)).toEqual(seededShuffle(items, 42));
  });

  test('gives a different order for a different seed, and keeps every item', () => {
    const a = seededShuffle(items, 1);
    const b = seededShuffle(items, 2);
    expect(a).not.toEqual(b);
    expect([...a].sort((x, y) => x - y)).toEqual(items);
  });

  test('does not change the list it was given', () => {
    const copy = [...items];
    seededShuffle(items, 7);
    expect(items).toEqual(copy);
  });
});

describe('recommendations (explore)', () => {
  test('only public posts from people I do not follow, never mine, never deleted', () => {
    const result = recommendations(
      [
        post('mine', { uid: 'me' }),
        post('followed', { uid: 'friend' }),
        post('gone', { deleted: true }),
        post('secret', { visibility: 'followers' }),
        post('private', { visibility: 'private' }),
        post('stranger'),
      ],
      options(['friend']),
    );
    expect(ids(result)).toEqual(['stranger']);
  });

  test('the same seed gives the same order whatever order the posts arrive in', () => {
    const posts = Array.from({ length: 12 }, (_, i) => post(`p${i}`));
    expect(ids(recommendations(posts, options([], 5)))).toEqual(
      ids(recommendations([...posts].reverse(), options([], 5))),
    );
  });

  test('a different seed gives a different order', () => {
    const posts = Array.from({ length: 12 }, (_, i) => post(`p${i}`));
    expect(ids(recommendations(posts, options([], 5)))).not.toEqual(
      ids(recommendations(posts, options([], 6))),
    );
  });

  test('is empty when there is nothing to recommend', () => {
    expect(recommendations([], options())).toEqual([]);
    expect(recommendations([post('mine', { uid: 'me' })], options())).toEqual(
      [],
    );
  });
});

describe('home feed mix', () => {
  const f = (n: number) => Array.from({ length: n }, (_, i) => `f${i + 1}`);
  const r = (n: number) => Array.from({ length: n }, (_, i) => `r${i + 1}`);

  test('puts one recommendation after every few posts from people I follow, and the leftovers after the followed posts run out', () => {
    expect(HOME_RECOMMEND_EVERY).toBe(4);
    expect(mixHome(f(10), r(5))).toEqual([
      'f1',
      'f2',
      'f3',
      'f4',
      'r1',
      'f5',
      'f6',
      'f7',
      'f8',
      'r2',
      'f9',
      'f10',
      'r3',
      'r4',
      'r5',
    ]);
  });

  test('keeps the order of both lists', () => {
    const mixed = mixHome(f(8), r(3));
    expect(mixed.filter(x => x.startsWith('f'))).toEqual(f(8));
    expect(mixed.filter(x => x.startsWith('r'))).toEqual(r(3));
    // 첫 추천 글은 팔로우한 사람의 글 4개 뒤에 온다
    expect(mixed.indexOf('r1')).toBe(4);
  });

  test('with nobody followed, the feed is all recommendations', () => {
    expect(mixHome([], r(3))).toEqual(r(3));
  });

  test('with nothing to recommend, the feed is just the followed posts', () => {
    expect(mixHome(f(6), [])).toEqual(f(6));
  });

  test('when the followed posts run out, recommendations carry on', () => {
    expect(mixHome(f(2), r(4))).toEqual(['f1', 'f2', 'r1', 'r2', 'r3', 'r4']);
  });

  test('loses and repeats nothing', () => {
    const mixed = mixHome(f(7), r(7));
    expect(mixed).toHaveLength(14);
    expect(new Set(mixed).size).toBe(14);
  });

  test('both empty gives an empty feed', () => {
    expect(mixHome([], [])).toEqual([]);
  });
});

describe('search result order (new chat)', () => {
  const user = (id: string, relation: 'following' | 'follower' | 'none') => ({
    id,
    relation,
  });

  test('people I follow come first, then people who follow me, then everyone else', () => {
    const sorted = rankByRelation([
      user('stranger-a', 'none'),
      user('fan', 'follower'),
      user('friend', 'following'),
      user('stranger-b', 'none'),
    ]);
    expect(sorted.map(u => u.id)).toEqual([
      'friend',
      'fan',
      'stranger-a',
      'stranger-b',
    ]);
  });

  test('people in the same group keep their original (name) order', () => {
    const sorted = rankByRelation([
      user('b', 'following'),
      user('a', 'following'),
      user('d', 'none'),
      user('c', 'none'),
    ]);
    expect(sorted.map(u => u.id)).toEqual(['b', 'a', 'd', 'c']);
  });

  test('handles an empty list', () => {
    expect(rankByRelation([])).toEqual([]);
  });
});
