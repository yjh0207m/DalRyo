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
  kind?: 'group';
  name?: string;
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
export type ChatPage<T, Cursor = ChatCursor> = {
  items: T[];
  cursor: Cursor | null;
  more: boolean;
};
export type InboxCursor = {
  direct: ChatCursor | null;
  group: ChatCursor | null;
};
type InboxPage = ChatPage<Conversation, InboxCursor> & {
  removedGroups?: string[];
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
function roomsQuery(group: boolean) {
  return firestore()
    .collection(group ? 'group_conversations' : 'conversations')
    .where('members', 'array-contains', myUid())
    .orderBy('updated_at', 'desc')
    .orderBy(documentId(), 'desc');
}
function roomRef(id: string) {
  return firestore()
    .collection(
      id.startsWith('group_') ? 'group_conversations' : 'conversations',
    )
    .doc(id);
}
function messagesQuery(id: string) {
  return roomRef(id)
    .collection('messages')
    .orderBy('created_at', 'desc')
    .orderBy(documentId(), 'desc');
}
function inboxPage(
  direct?: ChatPage<Conversation>,
  group?: ChatPage<Conversation>,
): InboxPage {
  const cursor = {
    direct: direct?.more ? direct.cursor : null,
    group: group?.more ? group.cursor : null,
  };
  return {
    items: [...(direct?.items ?? []), ...(group?.items ?? [])],
    cursor,
    more: !!(cursor.direct || cursor.group),
  };
}
export function watchConversations(
  next: (page: InboxPage) => void,
  error: (e: Error) => void,
) {
  let direct: ChatPage<Conversation> | undefined;
  let group: ChatPage<Conversation> | undefined;
  let groupReady = false;
  const stopDirect = roomsQuery(false)
    .limit(50)
    .onSnapshot(s => {
      direct = page(s, room);
      if (groupReady) next(inboxPage(direct, group));
    }, error);
  const stopGroup = roomsQuery(true)
    .limit(50)
    .onSnapshot(
      s => {
        groupReady = true;
        group = page(s, room);
        const tail = group.items.at(-1);
        const removedGroups = s.docChanges().flatMap(change => {
          if (change.type !== 'removed') return [];
          const updatedAt = millis(change.doc.get('updated_at'));
          // A room pushed out of the first page still belongs in loaded history.
          return !group?.more ||
            !tail ||
            updatedAt > tail.updatedAt ||
            (updatedAt === tail.updatedAt && change.doc.id > tail.id)
            ? [change.doc.id]
            : [];
        });
        if (direct)
          next({
            ...inboxPage(direct, group),
            removedGroups,
          });
      },
      e => {
        // 1:1 chat can still load while the new rules and index are rolling out.
        const code = (e as Error & { code?: string }).code ?? '';
        if (/permission-denied|failed-precondition/.test(code)) {
          groupReady = true;
          if (direct) next(inboxPage(direct));
        } else error(e);
      },
    );
  return () => {
    stopDirect();
    stopGroup();
  };
}
export async function earlierConversations(cursor: InboxCursor) {
  const [direct, group] = await Promise.all([
    cursor.direct &&
      roomsQuery(false).startAfter(cursor.direct).limit(50).get(),
    cursor.group && roomsQuery(true).startAfter(cursor.group).limit(50).get(),
  ]);
  return inboxPage(
    direct ? page(direct, room) : undefined,
    group ? page(group, room) : undefined,
  );
}
export function watchConversation(
  id: string,
  next: (room: Conversation | null) => void,
  error: (e: Error) => void,
) {
  return roomRef(id).onSnapshot(s => next(s.exists() ? room(s) : null), error);
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
export async function createGroupConversation(
  uids: string[],
  name: string,
  requestId: string,
) {
  return (
    await socialRequest<{ conversationId: string }>('chatCreateGroup', {
      uids,
      name,
      requestId,
    })
  ).conversationId;
}
export function leaveGroupConversation(conversationId: string) {
  return socialRequest('chatLeave', { conversationId });
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
