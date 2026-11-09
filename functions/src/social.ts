import { getApp } from 'firebase-admin/app';
import {
  FieldPath,
  FieldValue,
  getFirestore,
  Timestamp,
  type DocumentData,
  type DocumentSnapshot,
  type Transaction,
} from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import {
  documentId,
  scopedImageUrl,
  text,
  USER_ID_PATTERN,
} from './validation';
import { cleanEquipped } from './itemCatalog';
import { mixHome, rankByRelation, recommendations } from './explore';
import { chatAction, conversationId } from './chat';

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
    // 아이디가 생기기 전에 가입한 사용자는 null
    user_id:
      typeof data.user_id === 'string' && USER_ID_PATTERN.test(data.user_id)
        ? data.user_id
        : null,
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
type PostDto = DocumentData & {
  post_id: string;
  uid: string;
  createdAtMs: number;
  visibility?: string;
  deleted?: boolean;
};
function postDto(id: string, data: DocumentData): PostDto {
  const { created_at, updated_at, ...rest } = data;
  return {
    ...rest,
    uid: rest.uid,
    post_id: id,
    createdAtMs: created_at?.toMillis?.() ?? 0,
  };
}
// 차단은 두 문서로 남긴다. users/{나}/blocks/{상대}는 내 목록(앱이 읽는다),
// users/{상대}/blocked_by/{나}는 상대에게 내 글을 빼고 보여 주기 위한 서버 전용 사본이다
const blockRef = (owner: string, target: string) =>
  db().collection('users').doc(owner).collection('blocks').doc(target);
// 내가 차단했거나 나를 차단한 사람들. 목록에서 빼는 데 쓴다
async function blockedWith(uid: string) {
  const me = db().collection('users').doc(uid);
  const [mine, theirs] = await Promise.all([
    me.collection('blocks').limit(500).get(),
    me.collection('blocked_by').limit(500).get(),
  ]);
  return new Set([...mine.docs, ...theirs.docs].map(doc => doc.id));
}
// 둘 중 누구라도 상대를 차단했으면 반응(팔로우·응원·댓글)을 받지 않는다
async function blockedBetween(a: string, b: string, tx: Transaction) {
  if (a === b) return false;
  const [one, other] = await Promise.all([
    tx.get(blockRef(a, b)),
    tx.get(blockRef(b, a)),
  ]);
  return one.exists || other.exists;
}
// 프로필 공개 설정. 값이 없으면 모두 공개다
function privacyOf(data?: DocumentData) {
  return {
    runs_public: data?.privacy?.runs_public !== false,
    connections_public: data?.privacy?.connections_public !== false,
  };
}
// 프로필의 러닝 기록 한 줄
function runSummary(run: DocumentSnapshot) {
  const started = run.get('started_at');
  return {
    day:
      started
        ?.toDate?.()
        .toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }) ?? '',
    distance_km: Math.max(0, Number(run.get('distance_km')) || 0),
    duration_sec: count(run.get('duration_sec')),
    avg_pace_sec: count(run.get('avg_pace_sec')),
    startedAtMs: started?.toMillis?.() ?? 0,
  };
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
      // 알림 목록에서 상대의 사진을 바로 보여 주기 위한 사본. publicUser가 https 주소만 통과시킨다
      actor_image: actor.profile_image,
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
      if (
        [
          'chatOpen',
          'chatCreateGroup',
          'chatSend',
          'chatRead',
          'chatBlock',
          'chatLeave',
        ].includes(input.action)
      )
        return await chatAction(uid, input);
      if (input.action === 'publicProfiles') {
        if (
          !Array.isArray(input.uids) ||
          input.uids.length > 30 ||
          !input.uids.length
        )
          throw new Error('프로필 목록을 확인해 주세요.');
        const ids = [
          ...new Set((input.uids as unknown[]).map(id => documentId(id))),
        ];
        const people = await db().getAll(
          ...ids.map(id => db().collection('users').doc(id)),
        );
        return {
          users: people
            .filter(person => person.exists)
            .map(person => publicUser(person.id, person.data()!)),
        };
      }
      if (input.action === 'search' || input.action === 'rankings') {
        // 검색어가 @로 시작하면 아이디로, 아니면 닉네임으로 찾는다
        const byId =
          input.action === 'search' &&
          typeof input.query === 'string' &&
          input.query.trim().startsWith('@');
        let query = db()
          .collection('users')
          .orderBy(
            input.action === 'rankings'
              ? 'total_km'
              : byId
              ? 'user_id'
              : 'display_name',
            input.action === 'rankings' ? 'desc' : 'asc',
          );
        if (input.action === 'search') {
          const prefix = byId
            ? text(input.query.trim().slice(1).toLowerCase(), '아이디', 1, 20)
            : text(input.query, '닉네임', 1, 20);
          query = query.startAt(prefix).endAt(`${prefix}\uf8ff`);
        }
        const [snapshot, blocked] = await Promise.all([
          query.limit(50).get(),
          blockedWith(uid),
        ]);
        const users = snapshot.docs
          .filter(doc => !blocked.has(doc.id))
          .map(doc => publicUser(doc.id, doc.data()));
        if (input.action !== 'search') return { users };
        // 검색 결과는 내가 팔로우한 사람 > 나를 팔로우한 사람 > 모르는 사람 순으로 보여 준다
        const others = users;
        const refs = others.flatMap(user => [
          db().collection('follows').doc(`${uid}_${user.uid}`),
          db().collection('follows').doc(`${user.uid}_${uid}`),
        ]);
        const edges = refs.length ? await db().getAll(...refs) : [];
        return {
          users: rankByRelation(
            others.map((user, i) => ({
              ...user,
              relation: edges[i * 2].exists
                ? ('following' as const)
                : edges[i * 2 + 1].exists
                ? ('follower' as const)
                : ('none' as const),
            })),
          ),
        };
      }
      if (input.action === 'profile') {
        const target = documentId(input.uid);
        const [
          profile,
          follow,
          followBack,
          pet,
          runCount,
          recentRuns,
          iBlocked,
          blockedMe,
          publicPosts,
          followerPosts,
        ] = await Promise.all([
          db().collection('users').doc(target).get(),
          db().collection('follows').doc(`${uid}_${target}`).get(),
          db().collection('follows').doc(`${target}_${uid}`).get(),
          db()
            .collection('users')
            .doc(target)
            .collection('character')
            .doc(target)
            .get(),
          db().collection('runs').where('uid', '==', target).count().get(),
          db()
            .collection('runs')
            .where('uid', '==', target)
            .orderBy('started_at', 'desc')
            .limit(10)
            .get(),
          blockRef(uid, target).get(),
          blockRef(target, uid).get(),
          db()
            .collection('posts')
            .where('uid', '==', target)
            .where('visibility', '==', 'public')
            .count()
            .get(),
          db()
            .collection('posts')
            .where('uid', '==', target)
            .where('visibility', '==', 'followers')
            .count()
            .get(),
        ]);
        if (!profile.exists || (blockedMe.exists && target !== uid))
          throw new HttpsError('not-found', '사용자를 찾을 수 없어요.');
        // 비공개로 해 둔 러닝 기록·팔로워 목록은 본인에게만 보인다
        const priv = privacyOf(profile.data());
        const owner = target === uid;
        const runsHidden = !owner && !priv.runs_public;
        return {
          profile: publicUser(target, profile.data()!),
          // 내가 차단한 러너. 앱은 기록 대신 차단 해제 버튼을 보여 준다
          blocked: iBlocked.exists,
          following: follow.exists,
          // 서로 팔로우하면 친구 → 같이 달리기 요청 가능
          friend: follow.exists && followBack.exists,
          pet: pet.exists
            ? {
                character_type: String(pet.get('character_type') ?? ''),
                stage: String(pet.get('stage') ?? 'egg'),
                pet_name: String(pet.get('pet_name') ?? '달료').slice(0, 20),
                exp: count(pet.get('exp')),
                is_frozen: profile.get('is_frozen') === true,
                stat_stamina: count(pet.get('stat_stamina')),
                stat_speed: count(pet.get('stat_speed')),
                stat_endurance: count(pet.get('stat_endurance')),
                // 입고 있는 꾸미기 아이템. 홈 화면과 같은 모습으로 보여 주려고 함께 내려 준다
                equipped: cleanEquipped(pet.get('equipped')),
              }
            : null,
          run_count: runsHidden ? null : runCount.data().count,
          runs_hidden: runsHidden,
          connections_hidden: !owner && !priv.connections_public,
          // 설정 화면에서 쓰도록 본인에게만 내려 준다
          privacy: owner ? priv : undefined,
          // 프로필 목록에 보이는 글만 센다. 팔로워 공개 글은 본인과 팔로워에게만 보인다
          post_count:
            publicPosts.data().count +
            (target === uid || follow.exists ? followerPosts.data().count : 0),
          recent_runs: runsHidden ? [] : recentRuns.docs.map(runSummary),
        };
      }
      if (input.action === 'profileRuns') {
        const target = documentId(input.uid);
        if ((await blockedWith(uid)).has(target))
          return { runs: [], hasMore: false };
        if (target !== uid) {
          const owner = await db().collection('users').doc(target).get();
          if (!privacyOf(owner.data()).runs_public)
            return { runs: [], hasMore: false, hidden: true };
        }
        let query = db()
          .collection('runs')
          .where('uid', '==', target)
          .orderBy('started_at', 'desc');
        if (input.afterMs !== undefined) {
          if (
            typeof input.afterMs !== 'number' ||
            !Number.isFinite(input.afterMs)
          )
            throw new Error('다음 페이지를 확인해 주세요.');
          query = query.startAfter(Timestamp.fromMillis(input.afterMs));
        }
        const page = await query.limit(31).get();
        return {
          runs: page.docs.slice(0, 30).map(runSummary),
          hasMore: page.size > 30,
        };
      }
      if (input.action === 'connections') {
        const target = documentId(input.uid ?? uid);
        if (!['followers', 'following'].includes(input.kind))
          throw new Error('목록 종류를 확인해 주세요.');
        if (target !== uid) {
          const owner = await db().collection('users').doc(target).get();
          if (!privacyOf(owner.data()).connections_public)
            return { users: [], cursor: null, hidden: true };
        }
        const field =
          input.kind === 'followers' ? 'following_id' : 'follower_id';
        const otherField =
          input.kind === 'followers' ? 'follower_id' : 'following_id';
        let query = db()
          .collection('follows')
          .where(field, '==', target)
          .orderBy(FieldPath.documentId());
        if (input.cursor != null) {
          if (
            typeof input.cursor !== 'string' ||
            !/^[A-Za-z0-9_-]{1,257}$/.test(input.cursor)
          )
            throw new Error('목록 위치를 확인해 주세요.');
          query = query.startAfter(input.cursor);
        }
        const page = await query.limit(31).get();
        const edges = page.docs.slice(0, 30);
        const refs = edges.map(edge =>
          db()
            .collection('users')
            .doc(documentId(edge.get(otherField))),
        );
        const [people, blocked] = await Promise.all([
          refs.length ? db().getAll(...refs) : Promise.resolve([]),
          blockedWith(uid),
        ]);
        return {
          users: people
            .filter(person => person.exists && !blocked.has(person.id))
            .map(person => publicUser(person.id, person.data()!)),
          cursor: page.size > 30 ? edges[edges.length - 1].id : null,
        };
      }
      if (input.action === 'exploreFeed' || input.action === 'homeFeed') {
        // 탐색: 내가 팔로우하지 않은 사람들의 공개 글(지금은 무작위).
        // 피드: 내가 팔로우한 사람과 내 글을 최신순으로, 중간중간 추천 글(탐색과 같은 후보)을 끼워서.
        // 앱이 새로고침할 때마다 보내는 seed로 순서를 정하고, 10개씩 offset부터 나눠 준다.
        const offset =
          Number.isInteger(input.offset) &&
          input.offset >= 0 &&
          input.offset <= 90
            ? input.offset
            : 0;
        const seed =
          Number.isInteger(input.seed) &&
          input.seed >= 0 &&
          input.seed < 2 ** 31
            ? input.seed
            : 0;
        const home = input.action === 'homeFeed';
        const [recent, followDocs, blocked, hiddenDocs] = await Promise.all([
          db()
            .collection('posts')
            .where('visibility', '==', 'public')
            .orderBy('created_at', 'desc')
            .limit(200)
            .get(),
          db()
            .collection('follows')
            .where('follower_id', '==', uid)
            .limit(300)
            .get(),
          blockedWith(uid),
          userRef.collection('hidden_posts').limit(500).get(),
        ]);
        const hidden = new Set(hiddenDocs.docs.map(doc => doc.id));
        // 차단한 사람의 글과 내가 "보지 않음"으로 고른 글은 어디에도 나오지 않는다
        const wanted = (post: PostDto) =>
          !blocked.has(post.uid) && !hidden.has(post.post_id);
        const following = new Set<string>(
          followDocs.docs.map(d => d.get('following_id')),
        );
        const recommended = recommendations(
          recent.docs.map(doc => postDto(doc.id, doc.data())).filter(wanted),
          { uid, following, seed },
        );
        let list: Array<ReturnType<typeof postDto>> = recommended;
        if (home) {
          const authors = [uid, ...following];
          const snapshots = await Promise.all(
            Array.from({ length: Math.ceil(authors.length / 10) }, (_, i) =>
              db()
                .collection('posts')
                .where('uid', 'in', authors.slice(i * 10, i * 10 + 10))
                .where('visibility', 'in', ['public', 'followers'])
                .orderBy('created_at', 'desc')
                .orderBy(FieldPath.documentId(), 'desc')
                .limit(20)
                .get(),
            ),
          );
          const mine = snapshots
            .flatMap(snap => snap.docs.map(doc => postDto(doc.id, doc.data())))
            .filter(post => !post.deleted && wanted(post))
            .sort(
              (a, b) =>
                b.createdAtMs - a.createdAtMs ||
                (a.post_id < b.post_id ? 1 : -1),
            )
            .slice(0, 60);
          list = mixHome(mine, recommended.slice(0, 30));
        }
        return {
          posts: list.slice(offset, offset + 10),
          hasMore: list.length > offset + 10,
        };
      }
      if (input.action === 'followingFeed' || input.action === 'profilePosts') {
        if (
          input.action === 'profilePosts' &&
          (await blockedWith(uid)).has(documentId(input.uid))
        )
          return { posts: [], hasMore: false };
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
          const [me, other, follow, blocked] = await Promise.all([
            tx.get(userRef),
            tx.get(targetRef),
            tx.get(followRef),
            blockedBetween(uid, target, tx),
          ]);
          if (!other.exists)
            throw new HttpsError('not-found', '사용자를 찾을 수 없어요.');
          if (blocked && input.following)
            throw new HttpsError(
              'permission-denied',
              '이 러너를 팔로우할 수 없어요.',
            );
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
      if (input.action === 'setPrivacy') {
        // 보낸 항목만 바꾼다. 하나는 그대로 두고 다른 하나만 바꿀 수 있다
        const changes: Record<string, boolean> = {};
        for (const [key, field] of [
          ['runsPublic', 'privacy.runs_public'],
          ['connectionsPublic', 'privacy.connections_public'],
        ] as const) {
          if (input[key] === undefined) continue;
          if (typeof input[key] !== 'boolean')
            throw new Error('공개 설정을 확인해 주세요.');
          changes[field] = input[key];
        }
        if (!Object.keys(changes).length)
          throw new Error('바꿀 설정을 보내 주세요.');
        await userRef.update(changes);
        return privacyOf((await userRef.get()).data());
      }
      if (input.action === 'blockUser') {
        const target = documentId(input.uid);
        if (target === uid || typeof input.blocked !== 'boolean')
          throw new Error('차단 대상을 확인해 주세요.');
        const targetRef = db().collection('users').doc(target);
        const mineRef = blockRef(uid, target);
        const reverseRef = targetRef.collection('blocked_by').doc(uid);
        const roomRef = db()
          .collection('conversations')
          .doc(conversationId(uid, target));
        await db().runTransaction(async tx => {
          const [me, other, block, myFollow, theirFollow, room] =
            await Promise.all([
              tx.get(userRef),
              tx.get(targetRef),
              tx.get(mineRef),
              tx.get(db().collection('follows').doc(`${uid}_${target}`)),
              tx.get(db().collection('follows').doc(`${target}_${uid}`)),
              tx.get(roomRef),
            ]);
          if (!other.exists)
            throw new HttpsError('not-found', '사용자를 찾을 수 없어요.');
          if (block.exists === input.blocked) return;
          // 기존 대화방도 같이 막고, 차단을 풀면 같이 풀어 준다
          if (room.exists)
            tx.update(roomRef, {
              blocked_by: input.blocked
                ? FieldValue.arrayUnion(uid)
                : FieldValue.arrayRemove(uid),
            });
          if (!input.blocked) {
            tx.delete(mineRef);
            tx.delete(reverseRef);
            return;
          }
          const person = publicUser(target, other.data()!);
          tx.set(mineRef, {
            uid: target,
            display_name: person.display_name,
            user_id: person.user_id,
            profile_image: person.profile_image,
            created_at: now(),
          });
          tx.set(reverseRef, { uid, created_at: now() });
          // 차단하면 서로의 팔로우를 끊는다
          if (!myFollow.exists && !theirFollow.exists) return;
          const lost = (edge: boolean) => (edge ? 1 : 0);
          const myFollowers =
            count(me.get('follower_count')) - lost(theirFollow.exists);
          const theirFollowers =
            count(other.get('follower_count')) - lost(myFollow.exists);
          if (myFollow.exists) tx.delete(myFollow.ref);
          if (theirFollow.exists) tx.delete(theirFollow.ref);
          tx.update(userRef, {
            following_count: Math.max(
              0,
              count(me.get('following_count')) - lost(myFollow.exists),
            ),
            follower_count: Math.max(0, myFollowers),
            influencer_tier: tier(Math.max(0, myFollowers)),
          });
          tx.update(targetRef, {
            following_count: Math.max(
              0,
              count(other.get('following_count')) - lost(theirFollow.exists),
            ),
            follower_count: Math.max(0, theirFollowers),
            influencer_tier: tier(Math.max(0, theirFollowers)),
          });
        });
        return { blocked: input.blocked };
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
      if (input.action === 'hidePost') {
        await userRef
          .collection('hidden_posts')
          .doc(postId)
          .set({ post_id: postId, created_at: now() });
        return { hidden: true };
      }
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
          if (input.active && (await blockedBetween(uid, receiver, tx)))
            throw new HttpsError('permission-denied', '게시물을 볼 수 없어요.');
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
          if (await blockedBetween(uid, post.get('uid'), tx))
            throw new HttpsError('permission-denied', '댓글을 남길 수 없어요.');
          let replyToName: string | null = null;
          if (parentId) {
            const parent = await tx.get(
              postRef.collection('comments').doc(parentId),
            );
            if (!parent.exists || parent.get('deleted'))
              throw new HttpsError('not-found', '답글 대상을 찾을 수 없어요.');
            replyToName = parent.get('author_name') ?? null;
          }
          receiver = post.get('uid');
          tx.set(commentRef, {
            comment_id: commentId,
            uid,
            author_name: actor.display_name,
            author_image: actor.profile_image,
            text: body,
            parent_id: parentId,
            reply_to_name: replyToName,
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
          if (!comment.exists) return;
          if (
            !post.exists ||
            (comment.get('uid') !== uid && post.get('uid') !== uid)
          )
            throw new HttpsError(
              'permission-denied',
              '댓글을 삭제할 수 없어요.',
            );
          // 댓글과 그 아래 달린 답글을 모두 찾아 문서째 지운다. 답글의 답글까지 한 단계씩 내려간다
          const doomed = [comment];
          let frontier = [comment.id];
          while (frontier.length) {
            const pages = await Promise.all(
              Array.from({ length: Math.ceil(frontier.length / 30) }, (_, i) =>
                tx.get(
                  postRef
                    .collection('comments')
                    .where(
                      'parent_id',
                      'in',
                      frontier.slice(i * 30, i * 30 + 30),
                    ),
                ),
              ),
            );
            const found = pages.flatMap(page => page.docs);
            doomed.push(...found);
            frontier = found.map(doc => doc.id);
          }
          doomed.forEach(doc => tx.delete(doc.ref));
          // 예전 방식으로 삭제 표시만 남은 댓글은 이미 숫자에서 빠져 있다
          const removed = doomed.filter(doc => !doc.get('deleted')).length;
          tx.update(postRef, {
            comment_count: Math.max(
              0,
              count(post.get('comment_count')) - removed,
            ),
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
