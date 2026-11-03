import type { SocialComment } from '../src/services/social.service';
import { commentBranch, threadComments } from '../src/utils/commentThreads';

let clock = 0;
const comment = (
  id: string,
  parent: string | null = null,
  extra: Partial<SocialComment> = {},
): SocialComment => ({
  comment_id: id,
  uid: `user-${id}`,
  author_name: `이름-${id}`,
  author_image: null,
  text: `내용-${id}`,
  parent_id: parent,
  deleted: false,
  createdAtMs: ++clock,
  ...extra,
});
const ids = (list: SocialComment[]) => list.map(c => c.comment_id);

describe('showing comments as threads', () => {
  test('a reply to the first comment’s reply stays under the first comment, not at the end', () => {
    // 실제로 겪은 문제: 시간순으로만 그리면 r2가 맨 아래(마지막 댓글 c)에 달린 것처럼 보인다
    const list = [
      comment('a'),
      comment('r1', 'a'),
      comment('b'),
      comment('c'),
      comment('r2', 'r1'),
    ];
    expect(ids(threadComments(list))).toEqual(['a', 'r1', 'r2', 'b', 'c']);
  });

  test('threads keep the time order of their first comment, and replies keep time order inside', () => {
    const list = [
      comment('a'),
      comment('b'),
      comment('b1', 'b'),
      comment('a1', 'a'),
      comment('b2', 'b'),
      comment('a2', 'a1'),
    ];
    expect(ids(threadComments(list))).toEqual([
      'a',
      'a1',
      'a2',
      'b',
      'b1',
      'b2',
    ]);
  });

  test('every reply says who it answers, and a top-level comment says nothing', () => {
    const list = [comment('a'), comment('r1', 'a'), comment('r2', 'r1')];
    expect(threadComments(list).map(c => c.replyToName)).toEqual([
      null,
      '이름-a',
      '이름-r1',
    ]);
  });

  test('the saved name is used first, so it works when the parent is on an unloaded page', () => {
    const list = [
      comment('r1', 'not-loaded', { reply_to_name: '저장된 이름' }),
    ];
    expect(threadComments(list)[0].replyToName).toBe('저장된 이름');
  });

  test('a reply whose parent is not loaded yet is still shown, with no tag if the name is unknown', () => {
    const list = [comment('r1', 'not-loaded'), comment('r2', 'r1')];
    const shown = threadComments(list);
    expect(ids(shown)).toEqual(['r1', 'r2']);
    expect(shown[0].replyToName).toBeNull();
  });
});

describe('what is not shown', () => {
  test('a comment left over as “deleted” does not appear, and neither do the replies under it', () => {
    const list = [
      comment('a', null, { deleted: true }),
      comment('r1', 'a'),
      comment('r2', 'r1'),
      comment('b'),
    ];
    expect(ids(threadComments(list))).toEqual(['b']);
  });

  test('a deleted reply takes only its own branch with it', () => {
    const list = [
      comment('a'),
      comment('r1', 'a', { deleted: true }),
      comment('r2', 'r1'),
      comment('r3', 'a'),
    ];
    expect(ids(threadComments(list))).toEqual(['a', 'r3']);
  });

  test('comments by someone I blocked, and the replies under them, do not appear', () => {
    const list = [
      comment('a', null, { uid: 'blocked' }),
      comment('r1', 'a'),
      comment('b'),
      comment('r2', 'b', { uid: 'blocked' }),
      comment('r3', 'b'),
    ];
    expect(ids(threadComments(list, new Set(['blocked'])))).toEqual([
      'b',
      'r3',
    ]);
  });

  test('a broken loop in the data cannot hang the screen', () => {
    const list = [comment('x', 'y'), comment('y', 'x')];
    expect(ids(threadComments(list))).toEqual(['x', 'y']);
  });

  test('an empty list stays empty', () => {
    expect(threadComments([])).toEqual([]);
  });
});

describe('the branch of a comment', () => {
  const list = [
    comment('a'),
    comment('r1', 'a'),
    comment('b'),
    comment('r2', 'r1'),
    comment('r3', 'a'),
  ];

  test('includes the comment and every reply under it, at any depth', () => {
    expect(commentBranch(list, 'a').sort()).toEqual(['a', 'r1', 'r2', 'r3']);
  });

  test('of a reply includes only what hangs under that reply', () => {
    expect(commentBranch(list, 'r1').sort()).toEqual(['r1', 'r2']);
  });

  test('of a comment with no replies is just the comment', () => {
    expect(commentBranch(list, 'b')).toEqual(['b']);
  });
});
