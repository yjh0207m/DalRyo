import React, {useEffect, useRef, useState} from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {auth} from '../../lib/firebase';
import {
  getChatId,
  sendMessage,
  subscribeMessages,
  subscribeMyChats,
  type Chat,
  type ChatMessage,
} from '../../services/message.service';

const MINT = '#58CFA6';
const TEXT = '#1A1A1A';
const MUTED = '#9A9A9A';
const BG_RECV = '#F0F0F0';

type Props = {
  visible: boolean;
  onClose: () => void;
  myName: string;
  /** 바로 특정 유저와의 채팅으로 진입할 때 */
  initialTarget?: {uid: string; name: string};
};

type View = 'list' | 'chat';

export function ChatModal({visible, onClose, myName, initialTarget}: Props) {
  const [view, setView] = useState<View>(initialTarget ? 'chat' : 'list');
  const [target, setTarget] = useState<{uid: string; name: string} | null>(initialTarget ?? null);

  useEffect(() => {
    if (!visible) {
      setView(initialTarget ? 'chat' : 'list');
      setTarget(initialTarget ?? null);
    }
  }, [visible, initialTarget]);

  const openChat = (uid: string, name: string) => {
    setTarget({uid, name});
    setView('chat');
  };

  const goBack = () => {
    setTarget(null);
    setView('list');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          {view === 'list' ? (
            <ChatList myName={myName} onClose={onClose} onOpenChat={openChat} />
          ) : target ? (
            <ChatThread
              target={target}
              myName={myName}
              onClose={onClose}
              onBack={goBack}
            />
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

// ─── 채팅 목록 ─────────────────────────────────────────────────

function ChatList({
  myName,
  onClose,
  onOpenChat,
}: {
  myName: string;
  onClose: () => void;
  onOpenChat: (uid: string, name: string) => void;
}) {
  const [chats, setChats] = useState<Chat[]>([]);
  const myUid = auth().currentUser?.uid ?? '';

  useEffect(() => {
    return subscribeMyChats(setChats);
  }, []);

  return (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>메시지</Text>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={chats}
        keyExtractor={c => c.chat_id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyEmoji}>💬</Text>
            <Text style={styles.emptyText}>아직 메시지가 없어요</Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({item}) => {
          const otherUid = item.participants.find(p => p !== myUid) ?? '';
          const otherName = item.participant_names[otherUid] ?? '알 수 없음';
          return (
            <TouchableOpacity
              activeOpacity={0.75}
              style={styles.chatItem}
              onPress={() => onOpenChat(otherUid, otherName)}>
              <View style={styles.chatAvatar}>
                <Text style={styles.chatAvatarText}>{otherName.slice(0, 1)}</Text>
              </View>
              <View style={styles.chatInfo}>
                <Text style={styles.chatName}>{otherName}</Text>
                <Text style={styles.chatLast} numberOfLines={1}>{item.last_message}</Text>
              </View>
              <Text style={styles.chatTime}>{relativeTime(item.last_message_at)}</Text>
            </TouchableOpacity>
          );
        }}
      />
    </>
  );
}

// ─── 개별 채팅 ─────────────────────────────────────────────────

function ChatThread({
  target,
  myName,
  onClose,
  onBack,
}: {
  target: {uid: string; name: string};
  myName: string;
  onClose: () => void;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const flatRef = useRef<FlatList>(null);
  const myUid = auth().currentUser?.uid ?? '';
  const chatId = getChatId(myUid, target.uid);

  useEffect(() => {
    return subscribeMessages(chatId, msgs => {
      setMessages(msgs);
      setTimeout(() => flatRef.current?.scrollToEnd({animated: true}), 50);
    });
  }, [chatId]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setText('');
    try {
      await sendMessage(chatId, target.uid, target.name, trimmed, myName);
    } catch {
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.threadFlex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{target.name}</Text>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatRef}
        data={messages}
        keyExtractor={m => m.msg_id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.msgList}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>첫 메시지를 보내보세요 👋</Text>
          </View>
        }
        renderItem={({item}) => {
          const isMine = item.uid === myUid;
          return (
            <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
              {!isMine && <Text style={styles.bubbleName}>{item.author_name}</Text>}
              <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>{item.text}</Text>
              <Text style={[styles.bubbleTime, isMine && styles.bubbleTimeMine]}>
                {relativeTime(item.created_at)}
              </Text>
            </View>
          );
        }}
      />

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="메시지 입력..."
          placeholderTextColor={MUTED}
          value={text}
          onChangeText={setText}
          multiline
          returnKeyType="default"
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          activeOpacity={0.75}
          style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!text.trim() || sending}>
          <Text style={styles.sendBtnText}>전송</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function relativeTime(ts: any): string {
  const date = ts?.toDate?.() ?? new Date();
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return '방금';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

const styles = StyleSheet.create({
  overlay: {flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)'},
  backdrop: {flex: 1},
  sheet: {backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '80%'},
  handle: {width: 40, height: 4, borderRadius: 2, backgroundColor: '#E0E0E0', alignSelf: 'center', marginTop: 12, marginBottom: 4},
  header: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F0F0F0', gap: 8},
  title: {flex: 1, color: TEXT, fontSize: 17, fontWeight: '900'},
  closeBtn: {width: 32, height: 32, borderRadius: 16, backgroundColor: '#F4F4F4', alignItems: 'center', justifyContent: 'center'},
  closeBtnText: {color: '#555', fontSize: 13, fontWeight: '700'},
  backBtn: {width: 32, height: 32, alignItems: 'center', justifyContent: 'center'},
  backBtnText: {color: TEXT, fontSize: 24, fontWeight: '700', lineHeight: 28},
  listContent: {paddingHorizontal: 0, paddingBottom: 24},
  emptyWrap: {alignItems: 'center', paddingVertical: 60},
  emptyEmoji: {fontSize: 36, marginBottom: 12},
  emptyText: {color: MUTED, fontSize: 14, fontWeight: '700'},
  separator: {height: 1, backgroundColor: '#F5F5F5'},
  chatItem: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 12},
  chatAvatar: {width: 44, height: 44, borderRadius: 22, backgroundColor: MINT, alignItems: 'center', justifyContent: 'center'},
  chatAvatarText: {color: '#FFF', fontSize: 18, fontWeight: '900'},
  chatInfo: {flex: 1},
  chatName: {color: TEXT, fontSize: 14, fontWeight: '800', marginBottom: 2},
  chatLast: {color: MUTED, fontSize: 13, fontWeight: '500'},
  chatTime: {color: MUTED, fontSize: 12},
  threadFlex: {flex: 1},
  msgList: {paddingHorizontal: 16, paddingVertical: 12, gap: 8, flexGrow: 1, justifyContent: 'flex-end'},
  bubble: {maxWidth: '78%', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 4},
  bubbleMine: {alignSelf: 'flex-end', backgroundColor: MINT},
  bubbleTheirs: {alignSelf: 'flex-start', backgroundColor: BG_RECV},
  bubbleName: {color: MUTED, fontSize: 11, fontWeight: '700', marginBottom: 2},
  bubbleText: {color: TEXT, fontSize: 14, fontWeight: '500'},
  bubbleTextMine: {color: '#FFF'},
  bubbleTime: {color: '#999', fontSize: 10, marginTop: 4, textAlign: 'right'},
  bubbleTimeMine: {color: 'rgba(255,255,255,0.7)'},
  inputRow: {flexDirection: 'row', alignItems: 'flex-end', borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingHorizontal: 12, paddingVertical: 10, gap: 8, backgroundColor: '#FFF'},
  input: {flex: 1, minHeight: 40, maxHeight: 100, borderWidth: 1.5, borderColor: '#E8E8E8', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, color: TEXT, fontSize: 14, fontWeight: '500', backgroundColor: '#FAFAFA'},
  sendBtn: {height: 40, paddingHorizontal: 16, borderRadius: 20, backgroundColor: MINT, alignItems: 'center', justifyContent: 'center'},
  sendBtnDisabled: {backgroundColor: '#D0EDE4'},
  sendBtnText: {color: '#FFF', fontSize: 13, fontWeight: '800'},
});
