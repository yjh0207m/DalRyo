import { createHash } from 'node:crypto';
import {
  FieldValue,
  getFirestore,
  Timestamp,
  type DocumentData,
} from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { logger } from 'firebase-functions';
import { HttpsError } from 'firebase-functions/v2/https';
import { documentId, text } from './validation';

function profile(data: DocumentData) {
  return {
    display_name:
      typeof data.display_name === 'string'
        ? data.display_name.slice(0, 20)
        : '달리너',
    profile_image:
      typeof data.profile_image === 'string' &&
      data.profile_image.startsWith('https://')
        ? data.profile_image.slice(0, 3000)
        : null,
  };
}
function emptyRoom(members: string[], profiles: DocumentData) {
  return {
    members,
    profiles,
    blocked_by: [],
    read_at: {},
    last_text: '',
    last_sender_uid: null,
    last_message_id: null,
    last_sent_at: null,
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  };
}

function blockRefs(a: string, b: string) {
  const db = getFirestore();
  return [db.doc(`users/${a}/blocks/${b}`), db.doc(`users/${b}/blocks/${a}`)];
}

function groupBlockRefs(a: string, b: string) {
  return [
    ...blockRefs(a, b),
    getFirestore().doc(`conversations/${conversationId(a, b)}`),
  ];
}

async function ensureCanChat(
  tx: FirebaseFirestore.Transaction,
  refs: FirebaseFirestore.DocumentReference[],
) {
  if (!refs.length) return;
  const blocks = await tx.getAll(...refs);
  if (
    blocks.some(
      doc =>
        doc.exists &&
        (doc.ref.parent.id === 'blocks' || doc.get('blocked_by')?.length),
    )
  )
    throw new HttpsError(
      'permission-denied',
      '차단 관계가 있어 메시지를 주고받을 수 없어요.',
    );
}
export function conversationId(a: string, b: string) {
  return createHash('sha256')
    .update(JSON.stringify([a, b].sort()))
    .digest('hex');
}
// Writes use the existing authenticated social callable. Clients only read their rooms.
export async function chatAction(
  uid: string,
  input: Record<string, unknown>,
  senderName: string,
) {
  const db = getFirestore();
  if (input.action === 'chatOpen') {
    const peer = documentId(input.uid);
    if (peer === uid)
      throw new HttpsError(
        'invalid-argument',
        '나에게는 대화를 보낼 수 없어요.',
      );
    const id = conversationId(uid, peer),
      ref = db.collection('conversations').doc(id);
    await db.runTransaction(async tx => {
      const [mine, other, room, iBlocked, blockedMe] = await Promise.all([
        tx.get(db.doc(`users/${uid}`)),
        tx.get(db.doc(`users/${peer}`)),
        tx.get(ref),
        tx.get(db.doc(`users/${uid}/blocks/${peer}`)),
        tx.get(db.doc(`users/${peer}/blocks/${uid}`)),
      ]);
      if (!mine.exists || !other.exists)
        throw new HttpsError('not-found', '러너를 찾을 수 없어요.');
      if (iBlocked.exists || blockedMe.exists)
        throw new HttpsError(
          'permission-denied',
          '이 러너와 대화할 수 없어요.',
        );
      if (!room.exists)
        tx.create(
          ref,
          emptyRoom([uid, peer].sort(), {
            [uid]: profile(mine.data()!),
            [peer]: profile(other.data()!),
          }),
        );
      // Existing rooms keep their history and block state.
    });
    return { conversationId: id };
  }
  if (input.action === 'chatCreateGroup') {
    if (
      !Array.isArray(input.uids) ||
      input.uids.length < 2 ||
      input.uids.length > 9
    )
      throw new HttpsError(
        'invalid-argument',
        '함께 대화할 러너를 2~9명 선택해 주세요.',
      );
    const members = [uid, ...input.uids.map(documentId)].sort();
    if (new Set(members).size !== members.length)
      throw new HttpsError('invalid-argument', '참여자 목록을 확인해 주세요.');
    const name = text(input.name ?? '', '채팅방 이름', 0, 40);
    const requestId = documentId(input.requestId);
    const id = `group_${createHash('sha256')
      .update(JSON.stringify([uid, requestId]))
      .digest('hex')}`;
    const ref = db.doc(`group_conversations/${id}`);
    await db.runTransaction(async tx => {
      const existing = await tx.get(ref);
      if (existing.exists) {
        if (!existing.get('members').includes(uid))
          throw new HttpsError('permission-denied', '이미 나간 채팅방이에요.');
        return;
      }
      const users = await tx.getAll(
        ...members.map(member => db.doc(`users/${member}`)),
      );
      if (users.some(user => !user.exists))
        throw new HttpsError(
          'not-found',
          '참여자 중 찾을 수 없는 러너가 있어요.',
        );
      await ensureCanChat(
        tx,
        members.flatMap((a, index) =>
          members.slice(index + 1).flatMap(b => groupBlockRefs(a, b)),
        ),
      );
      tx.create(ref, {
        ...emptyRoom(
          members,
          Object.fromEntries(
            users.map(user => [user.id, profile(user.data()!)]),
          ),
        ),
        kind: 'group',
        name,
      });
    });
    return { conversationId: id };
  }
  const id = documentId(input.conversationId);
  const group = id.startsWith('group_');
  const ref = db
    .collection(group ? 'group_conversations' : 'conversations')
    .doc(id);
  if (input.action === 'chatMute' || input.action === 'chatRename') {
    await db.runTransaction(async tx => {
      const room = await tx.get(ref);
      if (!room.exists || !room.get('members').includes(uid))
        throw new HttpsError('permission-denied', '대화에 참여할 수 없어요.');
      if (input.action === 'chatMute') {
        if (typeof input.muted !== 'boolean')
          throw new HttpsError(
            'invalid-argument',
            '알림 설정을 확인해 주세요.',
          );
        tx.update(ref, {
          muted_by: input.muted
            ? FieldValue.arrayUnion(uid)
            : FieldValue.arrayRemove(uid),
        });
      } else {
        if (!group || room.get('kind') !== 'group')
          throw new HttpsError(
            'invalid-argument',
            '그룹 채팅방의 이름만 바꿀 수 있어요.',
          );
        tx.update(ref, { name: text(input.name, '채팅방 이름', 1, 40) });
      }
    });
    return { ok: true };
  }
  if (input.action === 'chatLeave') {
    await db.runTransaction(async tx => {
      const room = await tx.get(ref);
      if (
        room.get('kind') !== 'group' ||
        !Object.hasOwn(room.get('profiles'), uid)
      )
        throw new HttpsError(
          'permission-denied',
          '이 그룹 채팅방에서 나갈 수 없어요.',
        );
      if (!room.get('members').includes(uid)) return;
      const readAt = { ...room.get('read_at') };
      delete readAt[uid];
      // Keep the author snapshot for messages remaining members can still read.
      tx.update(ref, {
        members: FieldValue.arrayRemove(uid),
        muted_by: FieldValue.arrayRemove(uid),
        read_at: readAt,
      });
    });
    return { ok: true };
  }
  if (input.action === 'chatSend') {
    const messageId = documentId(input.messageId),
      body = text(input.text, '메시지', 1, 2000),
      message = ref.collection('messages').doc(messageId);
    const created = await db.runTransaction(async tx => {
      const [room, old] = await Promise.all([tx.get(ref), tx.get(message)]);
      if (!room.exists || !room.get('members').includes(uid))
        throw new HttpsError('permission-denied', '대화에 참여할 수 없어요.');
      if (old.exists) {
        if (old.get('sender_uid') !== uid || old.get('text') !== body)
          throw new HttpsError('already-exists', '이미 전송한 메시지예요.');
        return; // Lost responses may be retried without duplicating the message.
      }
      const peers = (room.get('members') as string[]).filter(
        member => member !== uid,
      );
      if (room.get('blocked_by').length)
        throw new HttpsError(
          'permission-denied',
          '차단된 대화에서는 메시지를 보낼 수 없어요.',
        );
      const last = room.get('last_sent_at') as Timestamp | null;
      if (
        last &&
        (!group || room.get('last_sender_uid') === uid) &&
        Date.now() - last.toMillis() < 500
      )
        throw new HttpsError('resource-exhausted', '잠시 후 다시 보내 주세요.');
      await ensureCanChat(
        tx,
        peers.flatMap(peer =>
          group ? groupBlockRefs(uid, peer) : blockRefs(uid, peer),
        ),
      );
      const stamp = FieldValue.serverTimestamp();
      tx.create(message, { sender_uid: uid, text: body, created_at: stamp });
      tx.update(ref, {
        last_text: body.slice(0, 120),
        last_sender_uid: uid,
        last_message_id: messageId,
        last_sent_at: stamp,
        updated_at: stamp,
        read_at: { ...room.get('read_at'), [uid]: stamp },
      });
      return true;
    });
    if (created) {
      // Push failure must not turn a saved message into a failed send.
      try {
        const room = await ref.get();
        const muted = new Set<string>(room.get('muted_by') ?? []);
        const recipients = ((room.get('members') ?? []) as string[]).filter(
          member => member !== uid && !muted.has(member),
        );
        if (recipients.length) {
          const users = await db.getAll(
            ...recipients.map(member => db.doc(`users/${member}`)),
          );
          const tokens = [
            ...new Set(
              users.flatMap(doc => {
                const user = doc.data();
                return user?.notification_settings?.push === true &&
                  typeof user.fcm_token === 'string' &&
                  user.fcm_token
                  ? [user.fcm_token]
                  : [];
              }),
            ),
          ];
          if (tokens.length) {
            const result = await getMessaging().sendEachForMulticast({
              tokens,
              notification: {
                title: group ? room.get('name') || '그룹 채팅' : senderName,
                body: group
                  ? `${senderName}님이 새 메시지를 보냈어요.`
                  : '새 메시지가 도착했어요.',
              },
              data: { type: 'chat', target_id: id },
              android: { priority: 'high', notification: { sound: 'default' } },
              apns: { payload: { aps: { sound: 'default' } } },
            });
            if (result.failureCount)
              logger.warn('chat push partially failed', {
                failures: result.failureCount,
              });
          }
        }
      } catch (error) {
        logger.warn('chat push failed', {
          code: (error as { code?: string })?.code,
        });
      }
    }
    return { messageId };
  }
  if (input.action === 'chatRead' || input.action === 'chatBlock') {
    await db.runTransaction(async tx => {
      const room = await tx.get(ref);
      if (!room.exists || !room.get('members').includes(uid))
        throw new HttpsError('permission-denied', '대화를 볼 수 없어요.');
      if (input.action === 'chatBlock') {
        if (group)
          throw new HttpsError(
            'invalid-argument',
            '그룹 채팅방은 차단할 수 없어요.',
          );
        if (typeof input.blocked !== 'boolean')
          throw new HttpsError(
            'invalid-argument',
            '차단 상태를 확인해 주세요.',
          );
        if (!input.blocked) {
          const peer = (room.get('members') as string[]).find(
            member => member !== uid,
          );
          if (
            peer &&
            (await tx.get(db.doc(`users/${uid}/blocks/${peer}`))).exists
          )
            throw new HttpsError(
              'failed-precondition',
              '러너 차단은 설정의 차단한 계정에서 해제해 주세요.',
            );
        }
        tx.update(ref, {
          blocked_by: input.blocked
            ? FieldValue.arrayUnion(uid)
            : FieldValue.arrayRemove(uid),
        });
      } else {
        // A newer message arriving before this request must stay unread.
        if (
          input.messageId !== room.get('last_message_id') ||
          !room.get('last_sent_at')
        )
          return;
        tx.update(ref, {
          read_at: { ...room.get('read_at'), [uid]: room.get('last_sent_at') },
        });
      }
    });
    return { ok: true };
  }
  throw new HttpsError('invalid-argument', '지원하지 않는 대화 요청이에요.');
}
