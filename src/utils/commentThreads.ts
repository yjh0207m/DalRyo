import type { SocialComment } from '../services/social.service';

export type ThreadedComment = SocialComment & {
  // 누구에게 단 답글인지. 원댓글이면 null
  replyToName: string | null;
};

// 댓글 창에 보여 줄 순서를 만든다. 입력은 시간순이다.
// - 원댓글 바로 아래에 그 스레드의 답글을 모두 모은다. 답글의 답글도 같은 원댓글 아래로 들어가고, 스레드 안은 시간순이다.
//   시간순으로만 늘어놓으면 답글이 맨 끝으로 밀려 마지막 댓글에 달린 것처럼 보인다.
// - 삭제된 댓글과 숨긴 사람의 댓글은 보여 주지 않고, 그 아래 달린 답글도 함께 보여 주지 않는다.
// - 원댓글이 아직 불러오지 않은 이전 페이지에 있으면, 불러온 것 중 가장 위 답글을 기준으로 스레드를 만든다.
export function threadComments(
  comments: SocialComment[],
  hiddenUids?: ReadonlySet<string>,
): ThreadedComment[] {
  const byId = new Map(comments.map(c => [c.comment_id, c]));
  const hidden = (comment: SocialComment) =>
    comment.deleted || !!hiddenUids?.has(comment.uid);
  // 위로 거슬러 올라가며 가장 위 댓글을 찾는다. 가려진 조상이 있으면 null
  const rootOf = (comment: SocialComment) => {
    const seen = new Set([comment.comment_id]);
    let current = comment;
    for (;;) {
      if (hidden(current)) return null;
      const parent = current.parent_id
        ? byId.get(current.parent_id)
        : undefined;
      if (!parent || seen.has(parent.comment_id)) return current;
      seen.add(parent.comment_id);
      current = parent;
    }
  };
  const threads = new Map<string, ThreadedComment[]>();
  for (const comment of comments) {
    const root = rootOf(comment);
    if (!root) continue;
    const parent = comment.parent_id ? byId.get(comment.parent_id) : undefined;
    const item: ThreadedComment = {
      ...comment,
      replyToName: comment.parent_id
        ? comment.reply_to_name ?? parent?.author_name ?? null
        : null,
    };
    // Map은 넣은 순서를 지키므로 스레드는 첫 댓글이 나온 시간순으로 놓인다
    const thread = threads.get(root.comment_id);
    if (thread) thread.push(item);
    else threads.set(root.comment_id, [item]);
  }
  return [...threads.values()].flat();
}

// 이 댓글과 그 아래 달린 답글 전부의 id. 답글이 있는지 알리고, 지운 뒤 목록에서 빼는 데 쓴다
export function commentBranch(comments: SocialComment[], id: string) {
  const branch = new Set([id]);
  // 입력이 시간순이라 부모가 항상 답글보다 먼저 나온다
  for (const comment of comments)
    if (comment.parent_id && branch.has(comment.parent_id))
      branch.add(comment.comment_id);
  return [...branch];
}
