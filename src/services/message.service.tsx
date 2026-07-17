import firestore from '@react-native-firebase/firestore';
import {auth, firestore as db} from '../lib/firebase';

export type Chat = {
  chat_id: string;
  participants: string[];
  participant_names: Record<string, string>;
  last_message: string;
  last_message_at: any;
};

export type ChatMessage = {
  msg_id: string;
  uid: string;
  author_name: string;
  text: string;
  created_at: any;
};

export function getChatId(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join('_');
}

export function subscribeMyChats(onChange: (chats: Chat[]) => void) {
  const currentUser = auth().currentUser;
  if (!currentUser) {onChange([]); return () => undefined;}
  return db()
    .collection('chats')
    .where('participants', 'array-contains', currentUser.uid)
    .onSnapshot(
      snap => {
        const sorted = snap.docs
          .map(d => d.data() as Chat)
          .sort((a, b) => (b.last_message_at?.toDate?.()?.getTime?.() ?? 0) - (a.last_message_at?.toDate?.()?.getTime?.() ?? 0));
        onChange(sorted);
      },
      () => onChange([]),
    );
}

export function subscribeMessages(chatId: string, onChange: (msgs: ChatMessage[]) => void) {
  return db()
    .collection('chats')
    .doc(chatId)
    .collection('messages')
    .onSnapshot(
      snap => {
        const sorted = snap.docs
          .map(d => d.data() as ChatMessage)
          .sort((a, b) => (a.created_at?.toDate?.()?.getTime?.() ?? 0) - (b.created_at?.toDate?.()?.getTime?.() ?? 0));
        onChange(sorted);
      },
      () => onChange([]),
    );
}

export async function sendMessage(
  chatId: string,
  targetUid: string,
  targetName: string,
  text: string,
  myName: string,
): Promise<void> {
  const currentUser = auth().currentUser;
  if (!currentUser) throw new Error('로그인이 필요해요.');
  const chatRef = db().collection('chats').doc(chatId);
  const msgRef = chatRef.collection('messages').doc();
  await Promise.all([
    msgRef.set({
      msg_id: msgRef.id,
      uid: currentUser.uid,
      author_name: myName,
      text: text.trim(),
      created_at: firestore.FieldValue.serverTimestamp(),
    } satisfies ChatMessage),
    chatRef.set({
      chat_id: chatId,
      participants: [currentUser.uid, targetUid],
      participant_names: {[currentUser.uid]: myName, [targetUid]: targetName},
      last_message: text.trim(),
      last_message_at: firestore.FieldValue.serverTimestamp(),
    } satisfies Chat, {merge: true}),
  ]);
}
