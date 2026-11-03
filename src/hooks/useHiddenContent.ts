import { useEffect, useState } from 'react';
import {
  watchBlockedUsers,
  watchHiddenPosts,
} from '../services/social.service';

const NOTHING: ReadonlySet<string> = new Set();

// 내가 차단한 사람과 "보지 않음"으로 고른 게시물. 서버 목록에서도 빠지지만,
// 이미 불러온 목록과 앱이 직접 읽는 댓글에도 바로 반영되도록 화면에서 한 번 더 거른다
export function useHiddenContent() {
  const [blockedUids, setBlockedUids] = useState(NOTHING);
  const [hiddenPostIds, setHiddenPostIds] = useState(NOTHING);
  useEffect(
    () =>
      watchBlockedUsers(users =>
        setBlockedUids(new Set(users.map(u => u.uid))),
      ),
    [],
  );
  useEffect(() => watchHiddenPosts(ids => setHiddenPostIds(new Set(ids))), []);
  return { blockedUids, hiddenPostIds };
}
