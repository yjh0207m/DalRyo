import {
  FieldPath,
  FieldValue,
  getFirestore,
  Timestamp,
  type DocumentData,
} from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { documentId, text } from './validation';
const now = () => FieldValue.serverTimestamp();
const MAX_PEOPLE = 20;
const open = (data: DocumentData | undefined) =>
  data &&
  ['waiting', 'running'].includes(data.status) &&
  data.expires_at?.toMillis() > Date.now();
const name = (data: DocumentData | undefined) =>
  typeof data?.display_name === 'string'
    ? data.display_name.slice(0, 20)
    : '달리너';
const image = (data: DocumentData | undefined) =>
  typeof data?.profile_image === 'string' &&
  data.profile_image.startsWith('https://')
    ? data.profile_image.slice(0, 3000)
    : null;

// 친구 = 서로 팔로우한 사이. 같이 달리기 요청은 친구에게만 보낼 수 있다
async function friendIds(uid: string) {
  const db = getFirestore();
  const [following, followers] = await Promise.all([
    db.collection('follows').where('follower_id', '==', uid).get(),
    db.collection('follows').where('following_id', '==', uid).get(),
  ]);
  const back = new Set(followers.docs.map(d => d.get('follower_id')));
  return following.docs
    .map(d => d.get('following_id') as string)
    .filter(id => back.has(id));
}
function inviteList(value: unknown) {
  if (
    !Array.isArray(value) ||
    value.length < 1 ||
    value.length > MAX_PEOPLE - 1
  )
    throw new Error('같이 달릴 친구를 1~19명 골라 주세요.');
  return [...new Set(value.map(documentId))];
}
async function pushInvite(receiver: string, host: string, roomId: string) {
  const user = (
    await getFirestore().collection('users').doc(receiver).get()
  ).data();
  if (
    !user?.fcm_token ||
    user.notification_settings?.push !== true ||
    user.notification_settings?.social === false
  )
    return;
  await getMessaging()
    .send({
      token: user.fcm_token,
      notification: {
        title: '달료',
        body: `${host}님이 같이 달리자고 요청했어요.`,
      },
      data: { type: 'room_invite', target_id: roomId },
    })
    .catch(error => logger.warn('room push failed', { code: error?.code }));
}
export const roomAction = onCall(
  { region: 'asia-northeast3', maxInstances: 10 },
  async request => {
    if (!request.auth)
      throw new HttpsError('unauthenticated', '로그인이 필요해요.');
    const uid = request.auth.uid,
      input = request.data ?? {},
      db = getFirestore();
    const userRef = db.collection('users').doc(uid),
      pointer = userRef.collection('room').doc('active');
    const user = (await userRef.get()).data();
    if (!user)
      throw new HttpsError(
        'failed-precondition',
        '프로필을 먼저 완료해 주세요.',
      );
    try {
      if (input.action === 'friends') {
        const ids = (await friendIds(uid)).slice(0, 200);
        const friends = [];
        for (let i = 0; i < ids.length; i += 30) {
          const snap = await db
            .collection('users')
            .where(FieldPath.documentId(), 'in', ids.slice(i, i + 30))
            .get();
          friends.push(
            ...snap.docs.map(d => ({
              uid: d.id,
              display_name: name(d.data()),
              profile_image: image(d.data()),
            })),
          );
        }
        friends.sort((a, b) => a.display_name.localeCompare(b.display_name));
        return { friends };
      }
      if (input.action === 'invites') {
        const snap = await userRef
          .collection('room_invites')
          .orderBy('created_at', 'desc')
          .limit(30)
          .get();
        const rooms = await Promise.all(
          snap.docs.map(d => db.collection('together_rooms').doc(d.id).get()),
        );
        return {
          invites: rooms
            .filter(r => {
              const d = r.data();
              return (
                open(d) &&
                d?.status === 'waiting' &&
                (d.invited ?? []).includes(uid)
              );
            })
            .map(r => {
              const d = r.data()!;
              return {
                room_id: r.id,
                title: d.title,
                host_uid: d.host_uid,
                host_name: d.host_name ?? '달리너',
                goal_km: d.goal_km,
                member_count: d.member_count,
                capacity: d.capacity,
              };
            }),
        };
      }
      const id = documentId(input.roomId),
        roomRef = db.collection('together_rooms').doc(id),
        memberRef = roomRef.collection('members').doc(uid),
        inviteRef = (to: string) =>
          db.collection('users').doc(to).collection('room_invites').doc(id);
      // 친구 확인은 트랜잭션 밖에서 (follows 쿼리). 방 상태는 트랜잭션 안에서 다시 확인한다
      const invitees =
        input.action === 'create' || input.action === 'invite'
          ? inviteList(input.inviteUids)
          : [];
      if (invitees.length) {
        const friends = new Set(await friendIds(uid));
        if (invitees.some(f => f === uid || !friends.has(f)))
          throw new HttpsError(
            'permission-denied',
            '서로 팔로우한 친구에게만 요청할 수 있어요.',
          );
      }
      const invitedNames: Record<string, string> = {};
      if (invitees.length) {
        const snaps = await db.getAll(
          ...invitees.map(f => db.collection('users').doc(f)),
        );
        snaps.forEach(s => (invitedNames[s.id] = name(s.data())));
      }
      const notified: string[] = [];
      const sendInvites = (
        tx: FirebaseFirestore.Transaction,
        targets: string[],
        title: string,
        goal: number,
      ) => {
        for (const to of targets) {
          tx.set(inviteRef(to), {
            room_id: id,
            host_uid: uid,
            host_name: name(user),
            title,
            goal_km: goal,
            created_at: now(),
          });
          tx.set(
            db
              .collection('users')
              .doc(to)
              .collection('notifications')
              .doc(`room_invite_${id}`),
            {
              type: 'room_invite',
              actor_uid: uid,
              actor_name: name(user),
              target_id: id,
              is_read: false,
              created_at: now(),
            },
          );
          notified.push(to);
        }
      };
      await db.runTransaction(async tx => {
        notified.length = 0;
        const [roomSnap, memberSnap, pointerSnap] = await Promise.all([
          tx.get(roomRef),
          tx.get(memberRef),
          tx.get(pointer),
        ]);
        const room = roomSnap.data(),
          member = memberSnap.data(),
          previous = pointerSnap.get('room_id');
        if (input.action === 'create' || input.action === 'join') {
          if (previous && previous !== id) {
            const existing = await tx.get(
              db.collection('together_rooms').doc(previous),
            );
            if (open(existing.data()))
              throw new HttpsError(
                'failed-precondition',
                '참가 중인 방을 먼저 나가 주세요.',
              );
          }
          if (input.action === 'create') {
            if (room) {
              if (room.host_uid !== uid)
                throw new HttpsError('already-exists', '다시 시도해 주세요.');
              return;
            }
            const title = text(input.title, '방 이름', 1, 40),
              goal = Number(input.goalKm);
            if (!Number.isFinite(goal) || goal < 0.1 || goal > 100)
              throw new Error('목표 거리를 확인해 주세요.');
            tx.create(roomRef, {
              room_id: id,
              title,
              goal_km: goal,
              capacity: invitees.length + 1,
              host_uid: uid,
              host_name: name(user),
              member_count: 1,
              invited: invitees,
              invited_names: invitedNames,
              participants: [uid, ...invitees],
              status: 'waiting',
              created_at: now(),
              updated_at: now(),
              expires_at: Timestamp.fromMillis(Date.now() + 12 * 3600000),
            });
            sendInvites(tx, invitees, title, goal);
          } else {
            if (!room || !open(room))
              throw new HttpsError('not-found', '종료됐거나 없는 방이에요.');
            if (member && member.state !== 'left') {
              tx.set(pointer, { room_id: id });
              return;
            }
            if (!(room.invited ?? []).includes(uid))
              throw new HttpsError(
                'permission-denied',
                '요청받은 방에만 참가할 수 있어요.',
              );
            if (room.status !== 'waiting')
              throw new HttpsError(
                'failed-precondition',
                '이미 달리기를 시작한 방이에요.',
              );
            if (room.member_count >= room.capacity)
              throw new HttpsError('resource-exhausted', '방이 가득 찼어요.');
            tx.update(roomRef, {
              member_count: FieldValue.increment(1),
              invited: FieldValue.arrayRemove(uid),
              updated_at: now(),
            });
            tx.delete(inviteRef(uid));
          }
          tx.set(memberRef, {
            uid,
            display_name: name(user),
            profile_image: image(user),
            current_km: 0,
            pace_sec: 0,
            state: 'active',
            joined_at: now(),
            updated_at: now(),
          });
          tx.set(pointer, { room_id: id });
          return;
        }
        if (input.action === 'decline') {
          tx.delete(inviteRef(uid));
          if (!room || !(room.invited ?? []).includes(uid)) return;
          tx.update(roomRef, {
            invited: FieldValue.arrayRemove(uid),
            capacity: Math.max(room.member_count, room.capacity - 1),
            updated_at: now(),
          });
          return;
        }
        if (
          room &&
          member &&
          input.action === 'leave' &&
          member.state === 'left'
        ) {
          if (previous === id) tx.delete(pointer);
          return;
        }
        if (
          room &&
          member &&
          input.action === 'finish' &&
          member.state === 'finished'
        )
          return;
        if (!room || !member || member.state === 'left')
          throw new HttpsError('permission-denied', '참가 중인 방이 아니에요.');
        if (input.action === 'invite') {
          if (room.host_uid !== uid)
            throw new HttpsError(
              'permission-denied',
              '방장만 친구를 부를 수 있어요.',
            );
          if (!open(room) || room.status !== 'waiting')
            throw new HttpsError(
              'failed-precondition',
              '시작 전에만 친구를 부를 수 있어요.',
            );
          const already = new Set<string>(room.participants ?? []);
          const fresh = invitees.filter(f => !already.has(f));
          if (room.capacity + fresh.length > MAX_PEOPLE)
            throw new Error(`한 방은 최대 ${MAX_PEOPLE}명까지예요.`);
          if (!fresh.length) return;
          tx.update(roomRef, {
            invited: FieldValue.arrayUnion(...fresh),
            participants: FieldValue.arrayUnion(...fresh),
            ...Object.fromEntries(
              fresh.map(f => [`invited_names.${f}`, invitedNames[f]]),
            ),
            capacity: room.capacity + fresh.length,
            updated_at: now(),
          });
          sendInvites(tx, fresh, room.title, room.goal_km);
          return;
        }
        if (input.action === 'start') {
          if (room.host_uid !== uid)
            throw new HttpsError(
              'permission-denied',
              '방장만 시작할 수 있어요.',
            );
          if (room.status === 'running') return;
          if (!open(room) || room.status !== 'waiting')
            throw new HttpsError(
              'failed-precondition',
              '시작할 수 없는 방이에요.',
            );
          // 시작하면 응답하지 않은 요청은 더 이상 받을 수 없다
          for (const pending of room.invited ?? [])
            tx.delete(inviteRef(pending));
          tx.update(roomRef, {
            status: 'running',
            invited: [],
            started_at: now(),
            updated_at: now(),
            expires_at: Timestamp.fromMillis(Date.now() + 24 * 3600000),
          });
          return;
        }
        if (input.action === 'leave' || input.action === 'finish') {
          if (input.action === 'finish' && room.status !== 'running')
            throw new HttpsError(
              'failed-precondition',
              '달리기 중에만 완료할 수 있어요.',
            );
          const snapshot = await tx.get(roomRef.collection('members'));
          const remaining = snapshot.docs.filter(
            doc => doc.id !== uid && doc.get('state') !== 'left',
          );
          if (input.action === 'leave') {
            tx.update(memberRef, { state: 'left', updated_at: now() });
            if (previous === id) tx.delete(pointer);
            const changes: FirebaseFirestore.UpdateData<DocumentData> = {
              member_count: Math.max(0, room.member_count - 1),
              updated_at: now(),
            };
            if (room.host_uid === uid && remaining.length) {
              changes.host_uid = remaining[0].id;
              changes.host_name = remaining[0].get('display_name') ?? '달리너';
            }
            if (!remaining.length) {
              changes.status =
                room.status === 'waiting' ? 'cancelled' : 'finished';
              changes.finished_at = now();
              changes.invited = [];
              for (const pending of room.invited ?? [])
                tx.delete(inviteRef(pending));
            } else if (
              room.status === 'running' &&
              remaining.every(doc => doc.get('state') === 'finished')
            ) {
              changes.status = 'finished';
              changes.finished_at = now();
            }
            tx.update(roomRef, changes);
          } else {
            const km = Number(input.km),
              pace = Number(input.pace);
            if (
              !Number.isFinite(km) ||
              km < 0 ||
              km > 100 ||
              !Number.isFinite(pace) ||
              pace < 0 ||
              pace > 86400
            )
              throw new Error('진행 기록을 확인해 주세요.');
            tx.update(memberRef, {
              state: 'finished',
              current_km: Math.max(member.current_km, km),
              pace_sec: pace,
              updated_at: now(),
            });
            const done = remaining.every(
              doc => doc.get('state') === 'finished',
            );
            tx.update(roomRef, {
              ...(done ? { status: 'finished', finished_at: now() } : {}),
              updated_at: now(),
            });
          }
          return;
        }
        throw new Error('지원하지 않는 방 작업이에요.');
      });
      await Promise.all(notified.map(to => pushInvite(to, name(user), id)));
      return { roomId: id };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError(
        'invalid-argument',
        error instanceof Error ? error.message : '방을 처리하지 못했어요.',
      );
    }
  },
);
