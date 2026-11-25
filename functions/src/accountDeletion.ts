import { getAuth } from 'firebase-admin/auth';
import {
  FieldValue,
  getFirestore,
  type DocumentReference,
  type DocumentSnapshot,
  type Query,
} from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { tier } from './social';

// 탈퇴한 사람이 남긴 채팅 메시지 옆에 보일 이름
export const DELETED_NAME = '탈퇴한 러너';

const db = () => getFirestore();
const count = (value: unknown) => Math.max(0, Math.floor(Number(value) || 0));
const PAGE = 200;

// 쿼리에 걸리는 문서를 다 처리할 때까지 나눠 가며 돈다. 처리한 문서는 쿼리에서 빠져야 한다(지우거나 조건이 바뀜)
async function drain(
  query: Query,
  handle: (doc: DocumentSnapshot) => Promise<void>,
) {
  for (;;) {
    const page = await query.limit(PAGE).get();
    if (page.empty) return;
    for (const doc of page.docs) await handle(doc);
    if (page.size < PAGE) return;
  }
}

// 다른 사람 글에 단 댓글과 그 아래 답글을 지우고 그 글의 댓글 수를 줄인다(socialAction의 deleteComment와 같은 규칙)
async function removeComment(comment: DocumentSnapshot) {
  const postRef = comment.ref.parent.parent as DocumentReference;
  await db().runTransaction(async tx => {
    const [post, fresh] = await Promise.all([
      tx.get(postRef),
      tx.get(comment.ref),
    ]);
    if (!fresh.exists) return;
    const doomed = [fresh];
    let frontier = [fresh.id];
    while (frontier.length) {
      const pages = await Promise.all(
        Array.from({ length: Math.ceil(frontier.length / 30) }, (_, i) =>
          tx.get(
            postRef
              .collection('comments')
              .where('parent_id', 'in', frontier.slice(i * 30, i * 30 + 30)),
          ),
        ),
      );
      const found = pages.flatMap(page => page.docs);
      doomed.push(...found);
      frontier = found.map(doc => doc.id);
    }
    doomed.forEach(doc => tx.delete(doc.ref));
    if (post.exists) {
      const removed = doomed.filter(doc => !doc.get('deleted')).length;
      tx.update(postRef, {
        comment_count: Math.max(0, count(post.get('comment_count')) - removed),
      });
    }
  });
}

// 응원(likes)·공유(shares) 기록을 지우고 그 글의 숫자를 하나 줄인다
async function removeReaction(
  reaction: DocumentSnapshot,
  field: 'like_count' | 'share_count',
) {
  const postRef = reaction.ref.parent.parent as DocumentReference;
  await db().runTransaction(async tx => {
    const [post, fresh] = await Promise.all([
      tx.get(postRef),
      tx.get(reaction.ref),
    ]);
    if (!fresh.exists) return;
    tx.delete(fresh.ref);
    if (post.exists)
      tx.update(postRef, { [field]: Math.max(0, count(post.get(field)) - 1) });
  });
}

// 팔로우 관계를 끊고 상대의 팔로워·팔로잉 수(와 인플루언서 등급)를 맞춘다
async function removeFollow(edge: DocumentSnapshot, uid: string) {
  const otherUid: string =
    edge.get('follower_id') === uid
      ? edge.get('following_id')
      : edge.get('follower_id');
  const otherRef = db().collection('users').doc(otherUid);
  await db().runTransaction(async tx => {
    const [fresh, other] = await Promise.all([
      tx.get(edge.ref),
      tx.get(otherRef),
    ]);
    if (!fresh.exists) return;
    tx.delete(fresh.ref);
    if (!other.exists) return;
    if (fresh.get('follower_id') === uid) {
      const followers = Math.max(0, count(other.get('follower_count')) - 1);
      tx.update(otherRef, {
        follower_count: followers,
        influencer_tier: tier(followers),
      });
    } else {
      tx.update(otherRef, {
        following_count: Math.max(0, count(other.get('following_count')) - 1),
      });
    }
  });
}

// 대화방: 메시지는 남기고 보낸 사람 이름·사진만 "탈퇴한 러너"로 바꾼다.
// 그룹에서는 나간 것처럼 빠지고, 1:1에서는 상대가 더 이상 보내지 못하게 표시한다
async function anonymizeConversation(room: DocumentSnapshot, uid: string) {
  await db().runTransaction(async tx => {
    const fresh = await tx.get(room.ref);
    if (!fresh.exists) return;
    const readAt = { ...(fresh.get('read_at') ?? {}) };
    delete readAt[uid];
    const group = fresh.ref.parent.id === 'group_conversations';
    tx.update(room.ref, {
      [`profiles.${uid}`]: { display_name: DELETED_NAME, profile_image: null },
      deleted_members: FieldValue.arrayUnion(uid),
      read_at: readAt,
      muted_by: FieldValue.arrayRemove(uid),
      ...(group ? { members: FieldValue.arrayRemove(uid) } : {}),
    });
  });
}

// 같이 달리기: 참가 중인 방에서 나간 것으로 하고, 남은 사람이 없으면 방을 닫는다
async function leaveRoom(uid: string) {
  const pointer = db()
    .collection('users')
    .doc(uid)
    .collection('room')
    .doc('active');
  const pointed = await pointer.get();
  const roomId: unknown = pointed.get('room_id');
  if (typeof roomId !== 'string') return;
  const roomRef = db().collection('together_rooms').doc(roomId);
  await db().runTransaction(async tx => {
    const [room, members] = await Promise.all([
      tx.get(roomRef),
      tx.get(roomRef.collection('members')),
    ]);
    if (!room.exists) return;
    const me = members.docs.find(doc => doc.id === uid);
    const remaining = members.docs.filter(
      doc => doc.id !== uid && doc.get('state') !== 'left',
    );
    if (me && me.get('state') !== 'left')
      tx.update(me.ref, {
        state: 'left',
        display_name: DELETED_NAME,
        profile_image: null,
        updated_at: FieldValue.serverTimestamp(),
      });
    const changes: Record<string, unknown> = {
      member_count: Math.max(0, count(room.get('member_count')) - (me ? 1 : 0)),
      updated_at: FieldValue.serverTimestamp(),
    };
    if (room.get('host_uid') === uid && remaining.length) {
      changes.host_uid = remaining[0].id;
      changes.host_name = remaining[0].get('display_name') ?? '달리너';
    }
    const open = ['waiting', 'running'].includes(room.get('status'));
    if (open && !remaining.length) {
      changes.status =
        room.get('status') === 'waiting' ? 'cancelled' : 'finished';
      changes.finished_at = FieldValue.serverTimestamp();
      changes.invited = [];
      for (const pending of (room.get('invited') ?? []) as string[])
        tx.delete(
          db()
            .collection('users')
            .doc(pending)
            .collection('room_invites')
            .doc(roomId),
        );
    }
    tx.update(roomRef, changes);
  });
}

// 회원 탈퇴. 그 사람이 만든 모든 것(프로필·캐릭터·기록·게시물과 그 댓글·응원, 남의 글에 단 댓글·응원·공유,
// 팔로우·차단·저장, 남에게 보낸 알림, 공원 랭킹, 사진 파일, 아이디, 로그인 계정)을 지운다.
// 채팅 메시지는 상대의 대화 기록이라 남기고, 보낸 사람만 "탈퇴한 러너"로 바꾼다.
// 중간에 실패해도 다시 부르면 남은 것부터 이어서 지운다(모든 단계가 이미 지운 것을 건너뛴다)
export const deleteAccount = onCall(
  {
    region: 'asia-northeast3',
    maxInstances: 5,
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  async request => {
    if (!request.auth)
      throw new HttpsError('unauthenticated', '로그인이 필요해요.');
    const uid = request.auth.uid;
    const userRef = db().collection('users').doc(uid);
    try {
      const user = await userRef.get();
      // 1. 내 게시물: 글과 그 아래 댓글·응원·공유, 남이 저장해 둔 기록까지
      await drain(
        db().collection('posts').where('uid', '==', uid),
        async post => {
          for (;;) {
            const saved = await db()
              .collection('bookmarks')
              .where('post_id', '==', post.id)
              .limit(PAGE)
              .get();
            if (saved.empty) break;
            const batch = db().batch();
            saved.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
          }
          await db().recursiveDelete(post.ref);
        },
      );
      // 2. 남의 글에 남긴 것
      await drain(
        db().collectionGroup('comments').where('uid', '==', uid),
        removeComment,
      );
      await drain(db().collectionGroup('likes').where('uid', '==', uid), doc =>
        removeReaction(doc, 'like_count'),
      );
      await drain(db().collectionGroup('shares').where('uid', '==', uid), doc =>
        removeReaction(doc, 'share_count'),
      );
      await drain(
        db().collection('bookmarks').where('uid', '==', uid),
        async doc => {
          await doc.ref.delete();
        },
      );
      // 3. 팔로우(양쪽)와 차단 사본
      await drain(
        db().collection('follows').where('follower_id', '==', uid),
        doc => removeFollow(doc, uid),
      );
      await drain(
        db().collection('follows').where('following_id', '==', uid),
        doc => removeFollow(doc, uid),
      );
      for (const [mine, theirs] of [
        ['blocks', 'blocked_by'],
        ['blocked_by', 'blocks'],
      ] as const) {
        const list = await userRef.collection(mine).get();
        for (const doc of list.docs)
          await db()
            .collection('users')
            .doc(doc.id)
            .collection(theirs)
            .doc(uid)
            .delete();
      }
      // 4. 남에게 보낸 알림, 공원 주간 랭킹, 달리기 기록
      await drain(
        db().collectionGroup('notifications').where('actor_uid', '==', uid),
        async doc => {
          await doc.ref.delete();
        },
      );
      await drain(
        db().collectionGroup('runners').where('uid', '==', uid),
        async doc => {
          await doc.ref.delete();
        },
      );
      await drain(
        db().collection('runs').where('uid', '==', uid),
        async doc => {
          await doc.ref.delete();
        },
      );
      // 5. 대화방(메시지는 남김)과 같이 달리기
      for (const name of ['conversations', 'group_conversations']) {
        const rooms = await db()
          .collection(name)
          .where('members', 'array-contains', uid)
          .get();
        for (const room of rooms.docs) await anonymizeConversation(room, uid);
      }
      await leaveRoom(uid);
      // 6. 아이디, 내 문서 전체(캐릭터·알림·보관함·차단 목록 등 하위 문서 포함)
      const userId: unknown = user.get('user_id');
      if (typeof userId === 'string') {
        const handle = db().collection('handles').doc(userId);
        const owner = await handle.get();
        if (owner.get('uid') === uid) await handle.delete();
      }
      await db().recursiveDelete(userRef);
      // 7. 사진 파일. 저장소를 못 지워도 계정 삭제는 이어 간다(기록만 남긴다)
      try {
        const bucket = getStorage().bucket();
        for (const prefix of ['profiles', 'posts', 'camera'])
          await bucket.deleteFiles({ prefix: `${prefix}/${uid}/` });
      } catch (error) {
        logger.warn('account deletion: storage cleanup failed', {
          code: (error as { code?: unknown })?.code,
        });
      }
      // 8. 로그인 계정
      try {
        await getAuth().deleteUser(uid);
      } catch (error) {
        if ((error as { code?: string })?.code !== 'auth/user-not-found')
          throw error;
      }
      return { deleted: true };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error('account deletion failed', {
        code: (error as { code?: unknown })?.code,
      });
      throw new HttpsError(
        'internal',
        '탈퇴를 마치지 못했어요. 잠시 후 다시 시도해 주세요.',
      );
    }
  },
);
