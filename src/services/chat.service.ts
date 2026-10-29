import {
  documentId,
  type FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';
import { firestore } from '../lib/firebase';
import { myUid, socialRequest } from './social.service';

export type ChatProfile = {
  display_name: string;
  profile_image: string | null;
};
export type Conversation = {
  id: string;
  members: string[];
  profiles: Record<string, ChatProfile>;
  blocked_by: string[];
  read_at: Record<string, number>;
  last_text: string;
  last_sender_uid: string | null;
  last_message_id: string | null;
  lastSentAt: number;
  updatedAt: number;
};
export type ChatMessage = {
  id: string;
  sender_uid: string;
  text: string;
  createdAt: number;
};
export type ChatCursor = FirebaseFirestoreTypes.QueryDocumentSnapshot;
export type ChatPage<T> = {
  items: T[];
  cursor: ChatCursor | null;
  more: boolean;
};
const millis = (value: unknown) =>
  (value as { toMillis?: () => number } | null)?.toMillis?.() ?? 0;
function room(doc: FirebaseFirestoreTypes.DocumentSnapshot): Conversation {
  const data = doc.data()!;
  return {
    ...data,
    id: doc.id,
    read_at: Object.fromEntries(
      Object.entries(data.read_at ?? {}).map(([uid, stamp]) => [
        uid,
        millis(stamp),
      ]),
    ),
    lastSentAt: millis(data.last_sent_at),
    updatedAt: millis(data.updated_at),
  } as Conversation;
}
function message(doc: ChatCursor): ChatMessage {
  const d = doc.data();
  return {
    id: doc.id,
    sender_uid: d.sender_uid,
    text: d.text,
    createdAt: millis(d.created_at),
  };
}
function page<T>(
  snap: FirebaseFirestoreTypes.QuerySnapshot,
  decode: (doc: ChatCursor) => T,
): ChatPage<T> {
  return {
    items: snap.docs.map(decode),
    cursor: snap.docs.at(-1) ?? null,
    more: snap.size === 50,
  };
}
function roomsQuery() {
  return firestore()
    .collection('conversations')
    .where('members', 'array-contains', myUid())
    .orderBy('updated_at', 'desc')
    .orderBy(documentId(), 'desc');
}
function messagesQuery(id: string) {
  return firestore()
    .collection('conversations')
    .doc(id)
    .collection('messages')
    .orderBy('created_at', 'desc')
    .orderBy(documentId(), 'desc');
}
export function watchConversations(
  next: (page: ChatPage<Conversation>) => void,
  error: (e: Error) => void,
) {
  return roomsQuery()
    .limit(50)
    .onSnapshot(s => next(page(s, room)), error);
}
export async function earlierConversations(cursor: ChatCursor) {
  return page(await roomsQuery().startAfter(cursor).limit(50).get(), room);
}
export function watchConversation(
  id: string,
  next: (room: Conversation | null) => void,
  error: (e: Error) => void,
) {
  return firestore()
    .collection('conversations')
    .doc(id)
    .onSnapshot(s => next(s.exists() ? room(s) : null), error);
}
export function watchMessages(
  id: string,
  next: (page: ChatPage<ChatMessage>) => void,
  error: (e: Error) => void,
) {
  return messagesQuery(id)
    .limit(50)
    .onSnapshot(s => next(page(s, message)), error);
}
export async function earlierMessages(id: string, cursor: ChatCursor) {
  return page(
    await messagesQuery(id).startAfter(cursor).limit(50).get(),
    message,
  );
}
export async function openConversation(uid: string) {
  return (await socialRequest<{ conversationId: string }>('chatOpen', { uid }))
    .conversationId;
}
export function newMessageId() {
  return firestore().collection('conversations').doc().id;
}
export function sendMessage(
  conversationId: string,
  messageId: string,
  text: string,
) {
  return socialRequest('chatSend', { conversationId, messageId, text });
}
export function markConversationRead(
  conversationId: string,
  messageId: string,
) {
  return socialRequest('chatRead', { conversationId, messageId });
}
export function blockConversation(conversationId: string, blocked: boolean) {
  return socialRequest('chatBlock', { conversationId, blocked });
}
export function hasUnread(conversation: Conversation, uid: string) {
  return (
    !!conversation.last_message_id &&
    conversation.last_sender_uid !== uid &&
    conversation.lastSentAt > (conversation.read_at[uid] ?? 0)
  );
}
export function mergeChatItems<T extends { id: string }>(old: T[], fresh: T[]) {
  return [...new Map([...old, ...fresh].map(item => [item.id, item])).values()];
}
