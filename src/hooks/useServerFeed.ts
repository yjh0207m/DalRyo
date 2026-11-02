import { useCallback, useEffect, useRef, useState } from 'react';
import { socialRequest, type SocialPost } from '../services/social.service';

type Page = { posts: SocialPost[]; hasMore: boolean };
// 피드: 팔로우한 사람 + 일부 추천. 탐색: 팔로우하지 않은 사람들의 글.
export type ServerFeed = 'homeFeed' | 'exploreFeed';

// 서버가 순서를 정해 주는 피드. 순서는 서버가 정한 그대로 보여 주고(시간순으로 다시 정렬하지 않는다),
// 더 불러올 때는 지금까지 받은 개수만큼 건너뛴 다음 묶음을 받는다.
// 새로고침할 때마다 새 seed를 만들어 보내고, 같은 새로고침 안의 "더 보기"는 같은 seed를 써서 순서가 이어진다
export function useServerFeed(action: ServerFeed) {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    'loading',
  );
  const [more, setMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState(false);
  const [revision, setRevision] = useState(0);
  const epoch = useRef(0);
  const loaded = useRef(0);
  const seed = useRef(0);
  const pending = useRef(false);

  useEffect(() => {
    const current = ++epoch.current;
    loaded.current = 0;
    seed.current = Math.floor(Math.random() * 2 ** 31);
    pending.current = false;
    setStatus('loading');
    setMore(false);
    setLoadingMore(false);
    setMoreError(false);
    socialRequest<Page>(action, { offset: 0, seed: seed.current })
      .then(result => {
        if (current !== epoch.current) return;
        loaded.current = result.posts.length;
        setPosts(result.posts);
        setMore(result.hasMore);
        setStatus('success');
      })
      .catch(() => {
        if (current === epoch.current) setStatus('error');
      });
    return () => {
      epoch.current = current + 1;
    };
  }, [action, revision]);

  const loadMore = useCallback(async () => {
    if (pending.current || !more) return;
    const current = epoch.current;
    pending.current = true;
    setLoadingMore(true);
    setMoreError(false);
    try {
      const result = await socialRequest<Page>(action, {
        offset: loaded.current,
        seed: seed.current,
      });
      if (current !== epoch.current) return;
      loaded.current += result.posts.length;
      setPosts(old => {
        const seen = new Set(old.map(post => post.post_id));
        return [...old, ...result.posts.filter(p => !seen.has(p.post_id))];
      });
      setMore(result.hasMore);
    } catch {
      if (current === epoch.current) setMoreError(true);
    } finally {
      if (current === epoch.current) {
        pending.current = false;
        setLoadingMore(false);
      }
    }
  }, [action, more]);

  return {
    posts,
    status,
    more,
    loadingMore,
    moreError,
    loadMore,
    refresh: () => setRevision(value => value + 1),
  };
}
