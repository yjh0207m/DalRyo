import { getApp } from 'firebase-admin/app';
import {
  FieldPath,
  FieldValue,
  getFirestore,
  Timestamp,
  type DocumentData,
  type Transaction,
} from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { documentId, scopedImageUrl, text } from './validation';

const db = () => getFirestore();
const now = () => FieldValue.serverTimestamp();
const count = (value: unknown) => Math.max(0, Math.floor(Number(value) || 0));
const tier = (followers: number) =>
  followers >= 1_000_000
    ? 'mega'
    : followers >= 100_000
    ? 'macro'
    : followers >= 10_000
    ? 'micro'
    : followers >= 1_000
    ? 'nano'
    : 'none';
function publicUser(uid: string, data: DocumentData) {
  return {
    uid,
    display_name:
      typeof data.display_name === 'string'
        ? data.display_name.slice(0, 20)
        : '달리너',
    profile_image:
      typeof data.profile_image === 'string' &&
      data.profile_image.startsWith('https://')
        ? data.profile_image.slice(0, 3000)
        : null,
    total_km: Number(data.total_km) || 0,
    region: typeof data.region === 'string' ? data.region.slice(0, 20) : '',
    follower_count: count(data.follower_count),
    following_count: count(data.following_count),
    influencer_tier: data.influencer_tier ?? 'none',
  };
}
function postDto(id: string, data: DocumentData) {
  const { created_at, updated_at, ...rest } = data;
  return { ...rest, post_id: id, createdAtMs: created_at?.toMillis?.() ?? 0 };
}
async function readable(uid: string, post: DocumentData, tx?: Transaction) {
  if (post.deleted) return false;
  if (post.uid === uid || post.visibility === 'public') return true;
  if (post.visibility !== 'followers') return false;
  const ref = db().collection('follows').doc(`${uid}_${post.uid}`);
  return (tx ? await tx.get(ref) : await ref.get()).exists;
}
function notification(
  tx: Transaction,
  receiver: string,
  key: string,
  actor: ReturnType<typeof publicUser>,
  type: string,
  target: string,
) {
  if (receiver === actor.uid) return;
  tx.set(
    db().collection('users').doc(receiver).collection('notifications').doc(key),
    {
      type,
      actor_uid: actor.uid,
      actor_name: actor.display_name,
      target_id: target,
      is_read: false,
      created_at: now(),
    },
  );
}
async function push(
  receiver: string,
  actor: ReturnType<typeof publicUser>,
  kind: string,
  target: string,
) {
  if (receiver === actor.uid) return;
  const user = (await db().collection('users').doc(receiver).get()).data();
  if (
    !user?.fcm_token ||
    user.notification_settings?.push !== true ||
    user.notification_settings?.social === false
  )
    return;
  const body = `${actor.display_name}님이 ${
    kind === 'follow'
      ? '팔로우했어요.'
      : kind === 'like'
      ? '응원했어요!'
      : '댓글을 남겼어요.'
  }`;
  await getMessaging()
    .send({
      token: user.fcm_token,
      notification: { title: '달료', body },
      data: { type: kind, target_id: target },
    })
    .catch(error => logger.warn('social push failed', { code: error?.code }));
}

export const socialAction = onCall(
  { region: 'asia-northeast3', maxInstances: 10, timeoutSeconds: 60 },
  async request => {
    if (!request.auth)
      throw new HttpsError('unauthenticated', '로그인이 필요해요.');
    const uid = request.auth.uid;
    const input = request.data ?? {};
    const userRef = db().collection('users').doc(uid);
    const mine = (await userRef.get()).data();
    if (!mine)
      throw new HttpsError(
        'failed-precondition',
        '프로필을 먼저 완료해 주세요.',
      );
    const actor = publicUser(uid, mine);
    try {
      if (input.action === 'search' || input.action === 'rankings') {
        let query = db()
          .collection('users')
          .orderBy(
            input.action === 'search' ? 'display_name' : 'total_km',
            input.action === 'search' ? 'asc' : 'desc',
          );
        if (input.action === 'search') {
          const prefix = text(input.query, '닉네임', 1, 20);
          query = query.startAt(prefix).endAt(`${prefix}\uf8ff`);
        }
        const snapshot = await query
          .limit(input.action === 'search' ? 20 : 50)
          .get();
        return {
          users: snapshot.docs.map(doc => publicUser(doc.id, doc.data())),
        };
      }
      if (input.action === 'profile') {
        const target = documentId(input.uid);
        const [profile, follow, followBack] = await Promise.all([
          db().collection('users').doc(target).get(),
          db().collection('follows').doc(`${uid}_${target}`).get(),
          db().collection('follows').doc(`${target}_${uid}`).get(),
        ]);
        if (!profile.exists)
          throw new HttpsError('not-found', '사용자를 찾을 수 없어요.');
        return {
          profile: publicUser(target, profile.data()!),
          following: follow.exists,
          // 서로 팔로우하면 친구 → 같이 달리기 요청 가능
          friend: follow.exists && followBack.exists,
        };
      }
      if (input.action === 'followingFeed' || input.action === 'profilePosts') {
        let ids: string[];
        if (input.action === 'profilePosts') ids = [documentId(input.uid)];
        else
          ids = (
            await db()
              .collection('follows')
              .where('follower_id', '==', uid)
              .limit(300)
              .get()
          ).docs.map(d => d.get('following_id') as string);
        const groups: string[][] = [];
        for (let i = 0; i < ids.length; i += 10)
          groups.push(ids.slice(i, i + 10));
        const snapshots = await Promise.all(
          groups.map(async authors => {
            let query = db()
              .collection('posts')
              .where('uid', 'in', authors)
              .where('visibility', 'in', ['public', 'followers'])
              .orderBy('created_at', 'desc')
              .orderBy(FieldPath.documentId(), 'desc');
            if (input.afterMs !== undefined) {
              if (
                typeof input.afterMs !== 'number' ||
                !Number.isFinite(input.afterMs)
              )
                throw new Error('다음 페이지를 확인해 주세요.');
              query = query.startAfter(
                Timestamp.fromMillis(input.afterMs),
                documentId(input.afterId),
              );
            }
            return query.limit(20).get();
          }),
        );
        const posts: Array<ReturnType<typeof postDto>> = [];
        const follows = new Set(
          input.action === 'followingFeed'
            ? ids
            : (
                await db()
                  .collection('follows')
                  .where('follower_id', '==', uid)
                  .limit(300)
                  .get()
              ).docs.map(d => d.get('following_id')),
        );
        for (const snap of snapshots)
          for (const doc of snap.docs) {
            const p = doc.data();
            if (
              !p.deleted &&
              (p.visibility === 'public' || p.uid === uid || follows.has(p.uid))
            )
              posts.push(postDto(doc.id, p));
          }
        posts.sort(
          (a, b) =>
            b.createdAtMs - a.createdAtMs || (a.post_id < b.post_id ? 1 : -1),
        );
        return { posts: posts.slice(0, 20), hasMore: posts.length >= 20 };
      }
      if (input.action === 'follow') {
        const target = documentId(input.uid);
        if (target === uid || typeof input.following !== 'boolean')
          throw new Error('팔로우 대상을 확인해 주세요.');
        const targetRef = db().collection('users').doc(target);
        const followRef = db().collection('follows').doc(`${uid}_${target}`);
        const changed = await db().runTransaction(async tx => {
          const [me, other, follow] = await Promise.all([
            tx.get(userRef),
            tx.get(targetRef),
            tx.get(followRef),
          ]);
          if (!other.exists)
            throw new HttpsError('not-found', '사용자를 찾을 수 없어요.');
          if (follow.exists === input.following) return false;
          const delta = input.following ? 1 : -1;
          const nextFollowing = count(me.get('following_count')) + delta;
          if (nextFollowing > 300)
            throw new HttpsError(
              'resource-exhausted',
              '팔로우는 최대 300명까지 가능해요.',
            );
          const nextFollowers = Math.max(
            0,
            count(other.get('follower_count')) + delta,
          );
          if (input.following)
            tx.set(followRef, {
              follower_id: uid,
              following_id: target,
              created_at: now(),
            });
          else tx.delete(followRef);
          tx.update(userRef, { following_count: Math.max(0, nextFollowing) });
          tx.update(targetRef, {
            follower_count: nextFollowers,
            influencer_tier: tier(nextFollowers),
          });
          if (input.following)
            notification(tx, target, `follow_${uid}`, actor, 'follow', uid);
          return true;
        });
        if (changed && input.following)
          await push(target, actor, 'follow', uid);
        return { following: input.following };
      }
      if (input.action === 'createPost') {
        const id = documentId(input.postId);
        const body = text(input.text ?? '', '내용', 0, 2000);
        const image = scopedImageUrl(
          input.imageUrl,
          uid,
          'posts',
          getApp().options.projectId,
        );
        if (!body && !image && !input.runId)
          throw new Error('내용이나 사진, 달리기 기록을 추가해 주세요.');
        if (!['public', 'followers', 'private'].includes(input.visibility))
          throw new Error('공개 범위를 확인해 주세요.');
        const ref = db().collection('posts').doc(id);
        await db().runTransaction(async tx => {
          const existing = await tx.get(ref);
          if (existing.exists) {
            if (existing.get('uid') !== uid)
              throw new HttpsError(
                'permission-denied',
                '게시물을 저장할 수 없어요.',
              );
            return;
          }
          let run: DocumentData | undefined;
          if (input.runId) {
            const snap = await tx.get(
              db().collection('runs').doc(documentId(input.runId)),
            );
            if (!snap.exists || snap.get('uid') !== uid)
              throw new HttpsError(
                'permission-denied',
                '본인 달리기 기록만 첨부할 수 있어요.',
              );
            run = snap.data();
          }
          tx.set(ref, {
            post_id: id,
            uid,
            author_name: actor.display_name,
            author_image: actor.profile_image,
            author_tier: actor.influencer_tier,
            category: 'feed',
            text: body,
            image_url: image,
            visibility: input.visibility,
            run_id: run ? input.runId : null,
            distance_km: run?.distance_km ?? null,
            avg_pace_sec: run?.avg_pace_sec ?? null,
            calories: run?.calories ?? null,
            hashtags: [
              ...new Set(
                (body.match(/#[\p{L}\p{N}_]{1,30}/gu) ?? []).map(s =>
                  s.slice(1),
                ),
              ),
            ].slice(0, 10),
            like_count: 0,
            comment_count: 0,
            deleted: false,
            dialect: mine.dialect ?? 'std',
            created_at: now(),
            updated_at: now(),
          });
        });
        return { postId: id };
      }
      const postId = documentId(input.postId);
      const postRef = db().collection('posts').doc(postId);
      if (input.action === 'post') {
        const post = (await postRef.get()).data();
        if (!post || !(await readable(uid, post)))
          throw new HttpsError('not-found', '게시물을 볼 수 없어요.');
        return { post: postDto(postId, post) };
      }
      if (input.action === 'editPost' || input.action === 'deletePost') {
        await db().runTransaction(async tx => {
          const post = await tx.get(postRef);
          if (!post.exists || post.get('uid') !== uid)
            throw new HttpsError(
              'permission-denied',
              '본인 게시물만 변경할 수 있어요.',
            );
          if (input.action === 'deletePost')
            tx.update(postRef, {
              deleted: true,
              visibility: 'private',
              text: '',
              image_url: null,
              updated_at: now(),
            });
          else {
            if (!['public', 'followers', 'private'].includes(input.visibility))
              throw new Error('공개 범위를 확인해 주세요.');
            const body = text(input.text, '내용', 0, 2000);
            if (!body && !post.get('image_url') && !post.get('run_id'))
              throw new Error('빈 게시물은 저장할 수 없어요.');
            tx.update(postRef, {
              text: body,
              visibility: input.visibility,
              updated_at: now(),
            });
          }
        });
        return { saved: true };
      }
      if (input.action === 'like' || input.action === 'bookmark') {
        if (typeof input.active !== 'boolean')
          throw new Error('선택 상태를 확인해 주세요.');
        const targetRef =
          input.action === 'like'
            ? postRef.collection('likes').doc(uid)
            : db().collection('bookmarks').doc(`${uid}_${postId}`);
        // Owners can remove their saved reference after access is revoked.
        if (input.action === 'bookmark' && !input.active) {
          await targetRef.delete();
          return { active: false };
        }
        let receiver = '';
        const changed = await db().runTransaction(async tx => {
          const [post, target] = await Promise.all([
            tx.get(postRef),
            tx.get(targetRef),
          ]);
          if (!post.exists || !(await readable(uid, post.data()!, tx)))
            throw new HttpsError('permission-denied', '게시물을 볼 수 없어요.');
          receiver = post.get('uid');
          if (target.exists === input.active) return false;
          if (input.active)
            tx.set(targetRef, { uid, post_id: postId, created_at: now() });
          else tx.delete(targetRef);
          if (input.action === 'like') {
            tx.update(postRef, {
              like_count: Math.max(
                0,
                count(post.get('like_count')) + (input.active ? 1 : -1),
              ),
            });
            if (input.active)
              notification(
                tx,
                receiver,
                `like_${postId}_${uid}`,
                actor,
                'like',
                postId,
              );
          }
          return true;
        });
        if (changed && input.active && input.action === 'like')
          await push(receiver, actor, 'like', postId);
        return { active: input.active };
      }
      if (input.action === 'comment') {
        const commentId = documentId(input.commentId);
        const body = text(input.text, '댓글', 1, 1000);
        const parentId = input.parentId ? documentId(input.parentId) : null;
        const commentRef = postRef.collection('comments').doc(commentId);
        let receiver = '';
        const changed = await db().runTransaction(async tx => {
          const [post, comment] = await Promise.all([
            tx.get(postRef),
            tx.get(commentRef),
          ]);
          if (!post.exists || !(await readable(uid, post.data()!, tx)))
            throw new HttpsError('permission-denied', '게시물을 볼 수 없어요.');
          if (comment.exists) {
            if (comment.get('uid') !== uid)
              throw new HttpsError(
                'permission-denied',
                '댓글을 저장할 수 없어요.',
              );
            return false;
          }
          if (parentId) {
            const parent = await tx.get(
              postRef.collection('comments').doc(parentId),
            );
            if (!parent.exists || parent.get('deleted'))
              throw new HttpsError('not-found', '답글 대상을 찾을 수 없어요.');
          }
          receiver = post.get('uid');
          tx.set(commentRef, {
            comment_id: commentId,
            uid,
            author_name: actor.display_name,
            author_image: actor.profile_image,
            text: body,
            parent_id: parentId,
            deleted: false,
            created_at: now(),
          });
          tx.update(postRef, {
            comment_count: count(post.get('comment_count')) + 1,
          });
          notification(
            tx,
            receiver,
            `comment_${commentId}`,
            actor,
            'comment',
            postId,
          );
          return true;
        });
        if (changed) await push(receiver, actor, 'comment', postId);
        return { commentId };
      }
      if (input.action === 'deleteComment') {
        const commentRef = postRef
          .collection('comments')
          .doc(documentId(input.commentId));
        await db().runTransaction(async tx => {
          const [post, comment] = await Promise.all([
            tx.get(postRef),
            tx.get(commentRef),
          ]);
          if (!comment.exists || comment.get('deleted')) return;
          if (
            !post.exists ||
            (comment.get('uid') !== uid && post.get('uid') !== uid)
          )
            throw new HttpsError(
              'permission-denied',
              '댓글을 삭제할 수 없어요.',
            );
          tx.update(commentRef, {
            deleted: true,
            text: '',
            author_name: '',
            author_image: null,
          });
          tx.update(postRef, {
            comment_count: Math.max(0, count(post.get('comment_count')) - 1),
          });
        });
        return { deleted: true };
      }
      throw new HttpsError('invalid-argument', '지원하지 않는 요청이에요.');
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      if (error instanceof Error && !('code' in error))
        throw new HttpsError('invalid-argument', error.message);
      logger.error('social action failed', {
        action: input.action,
        code: (error as { code?: unknown })?.code,
      });
      throw new HttpsError(
        'internal',
        '처리하지 못했어요. 잠시 후 다시 시도해 주세요.',
      );
    }
  },
);
