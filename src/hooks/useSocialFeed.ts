import { useCallback, useEffect, useRef, useState } from 'react';
import {
  earlierPosts,
  socialRequest,
  watchFeed,
  type FeedScope,
  type PostCursor,
  type SocialPost,
} from '../services/social.service';

function merged(live: SocialPost[], older: SocialPost[]) {
  const map = new Map(older.map(p => [p.post_id, p]));
  live.forEach(post => map.set(post.post_id, post));
  return [...map.values()]
    .filter(p => !p.deleted)
    .sort(
      (a, b) =>
        b.createdAtMs - a.createdAtMs || (a.post_id < b.post_id ? 1 : -1),
    );
}
export function useSocialFeed(scope: FeedScope) {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    'loading',
  );
  const [more, setMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState(false);
  const [revision, setRevision] = useState(0);
  const epoch = useRef(0);
  const live = useRef<SocialPost[]>([]);
  const older = useRef<SocialPost[]>([]);
  const cursor = useRef<PostCursor | null>(null);
  const remoteCursor = useRef<SocialPost | null>(null);
  const pending = useRef(false);
  useEffect(() => {
    const current = ++epoch.current;
    live.current = [];
    older.current = [];
    cursor.current = null;
    remoteCursor.current = null;
    pending.current = false;
    setPosts([]);
    setStatus('loading');
    setMore(false);
    setLoadingMore(false);
    setMoreError(false);
    if (scope === 'following') {
      socialRequest<{ posts: SocialPost[]; hasMore: boolean }>('followingFeed')
        .then(result => {
          if (current !== epoch.current) return;
          live.current = result.posts;
          remoteCursor.current = result.posts.at(-1) ?? null;
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
    }
    const stop = watchFeed(
      scope,
      (items, last, hasMore) => {
        if (current !== epoch.current) return;
        live.current = items;
        if (!older.current.length) {
          cursor.current = last;
          setMore(hasMore);
        }
        setPosts(merged(items, older.current));
        setStatus('success');
      },
      () => {
        if (current === epoch.current) setStatus('error');
      },
    );
    return () => {
      epoch.current = current + 1;
      stop();
    };
  }, [scope, revision]);
  const loadMore = useCallback(async () => {
    if (pending.current || !more) return;
    const current = epoch.current;
    pending.current = true;
    setLoadingMore(true);
    setMoreError(false);
    try {
      if (scope === 'following') {
        const last = remoteCursor.current;
        if (!last) return;
        const result = await socialRequest<{
          posts: SocialPost[];
          hasMore: boolean;
        }>('followingFeed', {
          afterMs: last.createdAtMs,
          afterId: last.post_id,
        });
        if (current !== epoch.current) return;
        older.current = merged(result.posts, older.current);
        remoteCursor.current = result.posts.at(-1) ?? last;
        setMore(result.hasMore);
      } else {
        if (!cursor.current) return;
        const result = await earlierPosts(scope, cursor.current);
        if (current !== epoch.current) return;
        older.current = merged(result.posts, older.current);
        cursor.current = result.last;
        setMore(result.more);
      }
      setPosts(merged(live.current, older.current));
    } catch {
      if (current === epoch.current) setMoreError(true);
    } finally {
      if (current === epoch.current) {
        pending.current = false;
        setLoadingMore(false);
      }
    }
  }, [scope, more]);
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
