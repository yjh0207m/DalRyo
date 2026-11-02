// 피드와 탐색에 쓰는 글 고르기.
// - 탐색: 내가 팔로우하지 않은 사람들의 공개 글을 섞어서 보여 준다(추천 기준은 나중에 정한다. 지금은 무작위).
// - 피드: 내가 팔로우한 사람(과 내) 글을 최신순으로 보여 주고, 중간중간 탐색용 추천 글을 끼워 넣는다.
// 무작위 순서는 앱이 새로고침할 때마다 정해서 보내는 seed로 만든다. 같은 seed면 순서가 같아서
// "더 보기"로 다음 묶음을 받아도 앞에서 본 글이 다시 나오거나 빠지지 않는다.
export type FeedPost = {
  post_id: string;
  uid: string;
  createdAtMs: number;
  visibility?: string;
  deleted?: boolean;
};

// 피드에서 이 개수만큼 팔로우한 사람의 글이 나오고 나면 추천 글 하나를 끼운다
export const HOME_RECOMMEND_EVERY = 4;

// seed로 만드는 작은 난수 생성기(mulberry32)
function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(items: T[], seed: number): T[] {
  const next = random(seed);
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// 추천 후보: 공개 글 중 내 글과 이미 팔로우한 사람의 글을 뺀 것. 순서는 seed로 섞는다
export function recommendations<T extends FeedPost>(
  posts: T[],
  options: { uid: string; following: Set<string>; seed: number },
): T[] {
  const pool = posts
    .filter(
      post =>
        !post.deleted &&
        post.visibility === 'public' &&
        post.uid !== options.uid &&
        !options.following.has(post.uid),
    )
    // 가져온 순서에 따라 결과가 달라지지 않도록 먼저 고정된 순서로 둔다
    .sort((a, b) =>
      a.post_id < b.post_id ? -1 : a.post_id > b.post_id ? 1 : 0,
    );
  return seededShuffle(pool, options.seed);
}

// 피드 순서: 팔로우한 사람(과 나)의 글을 최신순으로 두고, every개마다 추천 글 하나를 끼운다.
// 팔로우 글이 먼저 떨어지면 남은 추천 글이, 추천 글이 떨어지면 남은 팔로우 글이 이어진다
export function mixHome<T>(
  following: T[],
  recommended: T[],
  every = HOME_RECOMMEND_EVERY,
): T[] {
  const result: T[] = [];
  let f = 0;
  let r = 0;
  while (f < following.length || r < recommended.length) {
    const recommendTurn =
      (result.length + 1) % (every + 1) === 0 || f >= following.length;
    if (recommendTurn && r < recommended.length) result.push(recommended[r++]);
    else if (f < following.length) result.push(following[f++]);
    else result.push(recommended[r++]);
  }
  return result;
}

// 검색 결과 순서: 내가 팔로우한 사람 > 나를 팔로우한 사람 > 모르는 사람. 같은 관계끼리는 원래 순서를 지킨다
const RELATION_RANK = { following: 0, follower: 1, none: 2 } as const;
export function rankByRelation<
  T extends { relation: keyof typeof RELATION_RANK },
>(users: T[]): T[] {
  return users
    .map((user, index) => ({ user, index }))
    .sort(
      (a, b) =>
        RELATION_RANK[a.user.relation] - RELATION_RANK[b.user.relation] ||
        a.index - b.index,
    )
    .map(item => item.user);
}
