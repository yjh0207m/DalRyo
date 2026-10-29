import { createHash } from 'node:crypto';
import {
  FieldValue,
  getFirestore,
  Timestamp,
  type DocumentData,
} from 'firebase-admin/firestore';
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
export function conversationId(a: string, b: string) {
  return createHash('sha256')
    .update(JSON.stringify([a, b].sort()))
    .digest('hex');
}
// Writes use the existing authenticated social callable. Clients only read their rooms.
export async function chatAction(uid: string, input: Record<string, unknown>) {
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
      const [mine, other, room] = await Promise.all([
        tx.get(db.doc(`users/${uid}`)),
        tx.get(db.doc(`users/${peer}`)),
        tx.get(ref),
      ]);
      if (!mine.exists || !other.exists)
        throw new HttpsError('not-found', '러너를 찾을 수 없어요.');
      if (!room.exists)
        tx.create(ref, {
          members: [uid, peer].sort(),
          profiles: {
            [uid]: profile(mine.data()!),
            [peer]: profile(other.data()!),
          },
          blocked_by: [],
          read_at: {},
          last_text: '',
          last_sender_uid: null,
          last_message_id: null,
          last_sent_at: null,
          created_at: FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp(),
        });
      // Existing rooms keep their history and block state.
    });
    return { conversationId: id };
  }
  const id = documentId(input.conversationId),
    ref = db.collection('conversations').doc(id);
  if (input.action === 'chatSend') {
    const messageId = documentId(input.messageId),
      body = text(input.text, '메시지', 1, 2000),
      message = ref.collection('messages').doc(messageId);
    await db.runTransaction(async tx => {
      const [room, old] = await Promise.all([tx.get(ref), tx.get(message)]);
      if (!room.exists || !room.get('members').includes(uid))
        throw new HttpsError('permission-denied', '대화에 참여할 수 없어요.');
      if (old.exists) {
        if (old.get('sender_uid') !== uid || old.get('text') !== body)
          throw new HttpsError('already-exists', '이미 전송한 메시지예요.');
        return; // Lost responses may be retried without duplicating the message.
      }
      if (room.get('blocked_by').length)
        throw new HttpsError(
          'permission-denied',
          '차단된 대화에서는 메시지를 보낼 수 없어요.',
        );
      const last = room.get('last_sent_at') as Timestamp | null;
      if (last && Date.now() - last.toMillis() < 500)
        throw new HttpsError('resource-exhausted', '잠시 후 다시 보내 주세요.');
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
    });
    return { messageId };
  }
  if (input.action === 'chatRead' || input.action === 'chatBlock') {
    await db.runTransaction(async tx => {
      const room = await tx.get(ref);
      if (!room.exists || !room.get('members').includes(uid))
        throw new HttpsError('permission-denied', '대화를 볼 수 없어요.');
      if (input.action === 'chatBlock') {
        if (typeof input.blocked !== 'boolean')
          throw new HttpsError(
            'invalid-argument',
            '차단 상태를 확인해 주세요.',
          );
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
