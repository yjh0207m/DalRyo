import { useEffect, useRef, useState } from 'react';
import {
  earlierComments,
  watchComments,
  type PostCursor,
  type SocialComment,
} from '../services/social.service';

export function useComments(id: string, revision: number) {
  const [comments, setComments] = useState<SocialComment[]>([]);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    'loading',
  );
  const [more, setMore] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const epoch = useRef(0);
  const cursor = useRef<PostCursor | null>(null);
  const live = useRef<SocialComment[]>([]);
  const older = useRef<SocialComment[]>([]);
  const busy = useRef(false);
  const publish = () => {
    const map = new Map(older.current.map(c => [c.comment_id, c]));
    live.current.forEach(c => map.set(c.comment_id, c));
    setComments(
      [...map.values()].sort(
        (a, b) =>
          a.createdAtMs - b.createdAtMs ||
          a.comment_id.localeCompare(b.comment_id),
      ),
    );
  };
  useEffect(() => {
    const key = ++epoch.current;
    cursor.current = null;
    live.current = [];
    older.current = [];
    busy.current = false;
    setComments([]);
    setStatus('loading');
    setMore(false);
    setPending(false);
    setError(false);
    const stop = watchComments(
      id,
      (items, last, hasMore) => {
        if (key !== epoch.current) return;
        live.current = items;
        if (!older.current.length) {
          cursor.current = last;
          setMore(hasMore);
        }
        publish();
        setStatus('success');
      },
      () => {
        if (key === epoch.current) setStatus('error');
      },
    );
    return () => {
      epoch.current = key + 1;
      stop();
    };
  }, [id, revision]);
  const loadMore = async () => {
    if (busy.current || !more || !cursor.current) return;
    const key = epoch.current;
    busy.current = true;
    setPending(true);
    setError(false);
    try {
      const result = await earlierComments(id, cursor.current);
      if (key !== epoch.current) return;
      older.current.push(...result.comments);
      cursor.current = result.cursor;
      setMore(result.more);
      publish();
    } catch {
      if (key === epoch.current) setError(true);
    } finally {
      if (key === epoch.current) {
        busy.current = false;
        setPending(false);
      }
    }
  };
  return { comments, status, more, pending, error, loadMore };
}
