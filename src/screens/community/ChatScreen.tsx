import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  BackHandler,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowUp,
  ChevronLeft,
  MessageSquare,
  MoreHorizontal,
  Search,
  UserRound,
} from 'lucide-react-native';
import { AppText, Button, IconButton } from '../../components/ui';
import { colors, fonts } from '../../theme';
import {
  myUid,
  socialError,
  socialRequest,
  type PublicProfile,
} from '../../services/social.service';
import {
  blockConversation,
  earlierConversations,
  earlierMessages,
  hasUnread,
  markConversationRead,
  mergeChatItems,
  newMessageId,
  openConversation,
  sendMessage,
  watchConversation,
  watchConversations,
  watchMessages,
  type ChatCursor,
  type ChatMessage,
  type ChatProfile,
  type Conversation,
} from '../../services/chat.service';

function chatError(error: unknown) {
  const code = (error as { code?: string } | null)?.code ?? '';
  if (code.includes('firestore/permission-denied'))
    return '대화를 불러올 수 없어요. 잠시 후 다시 시도해 주세요.';
  if (code.includes('firestore/failed-precondition'))
    return '메시지를 준비하고 있어요. 잠시 후 다시 시도해 주세요.';
  if (
    code.includes('unavailable') ||
    code.includes('network') ||
    code.includes('deadline-exceeded')
  )
    return '인터넷 연결을 확인한 뒤 다시 시도해 주세요.';
  return socialError(error);
}

function Avatar({ profile }: { profile?: ChatProfile }) {
  return (
    <View style={s.avatar}>
      {profile?.profile_image ? (
        <Image source={{ uri: profile.profile_image }} style={s.avatarImage} />
      ) : (
        <UserRound size={23} color={colors.primaryInk} />
      )}
    </View>
  );
}
function Header({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack: () => void;
  right?: React.ReactNode;
}) {
  return (
    <View style={s.header}>
      <IconButton
        icon={ChevronLeft}
        variant="plain"
        accessibilityLabel="대화에서 뒤로"
        onPress={onBack}
      />
      <AppText variant="heading" numberOfLines={1} style={s.headerTitle}>
        {title}
      </AppText>
      {right ?? <View style={s.spacer} />}
    </View>
  );
}
function useBack(onBack: () => void) {
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);
}
function Failure({ error, retry }: { error: string; retry: () => void }) {
  return (
    <View style={s.empty}>
      <AppText align="center" color={colors.textMuted}>
        {error}
      </AppText>
      <Button size="md" label="다시 시도" onPress={retry} />
    </View>
  );
}

export function ChatScreen({
  onBack,
  initialPeer,
}: {
  onBack: () => void;
  initialPeer?: string;
}) {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [opening, setOpening] = useState(!!initialPeer);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [choosing, setChoosing] = useState(false);
  const [rooms, setRooms] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [more, setMore] = useState(false);
  const historyLoaded = useRef(false);
  const cursor = useRef<ChatCursor | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const open = useCallback(async (uid: string) => {
    setOpening(true);
    setError('');
    try {
      const id = await openConversation(uid);
      if (alive.current) {
        setRoomId(id);
        setChoosing(false);
      }
    } catch (e) {
      if (alive.current) setError(chatError(e));
    } finally {
      if (alive.current) setOpening(false);
    }
  }, []);
  useEffect(() => {
    if (initialPeer) open(initialPeer);
  }, [initialPeer, open, revision]);
  useEffect(() => {
    setLoading(true);
    setError('');
    return watchConversations(
      page => {
        setRooms(old =>
          mergeChatItems(old, page.items).sort(
            (a, b) => b.updatedAt - a.updatedAt,
          ),
        );
        if (!historyLoaded.current) {
          cursor.current = page.cursor;
          setMore(page.more);
        }
        setLoading(false);
      },
      e => {
        setError(chatError(e));
        setLoading(false);
      },
    );
  }, [revision]);
  const back = useCallback(() => {
    if (roomId) {
      if (initialPeer) onBack();
      else setRoomId(null);
    } else if (choosing) {
      setChoosing(false);
      setRevision(value => value + 1);
    } else onBack();
  }, [roomId, choosing, initialPeer, onBack]);
  useBack(back);
  const loadMore = async () => {
    if (!cursor.current || loadingMore) return;
    setLoadingMore(true);
    historyLoaded.current = true;
    try {
      const page = await earlierConversations(cursor.current);
      if (alive.current) {
        setRooms(old =>
          mergeChatItems(old, page.items).sort(
            (a, b) => b.updatedAt - a.updatedAt,
          ),
        );
        cursor.current = page.cursor;
        setMore(page.more);
      }
    } catch (e) {
      Alert.alert('대화를 불러오지 못했어요', chatError(e));
    } finally {
      if (alive.current) setLoadingMore(false);
    }
  };
  if (roomId)
    return <ConversationView key={roomId} id={roomId} onBack={back} />;
  if (opening)
    return (
      <SafeAreaView style={s.screen}>
        <Header title="대화 열기" onBack={back} />
        <ActivityIndicator style={s.loader} color={colors.primary} />
      </SafeAreaView>
    );
  if (choosing)
    return <NewChat onBack={back} onSelect={open} openError={error} />;
  return (
    <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
      <Header
        title="메시지"
        onBack={back}
        right={
          <IconButton
            icon={MessageSquare}
            variant="plain"
            accessibilityLabel="새 대화"
            onPress={() => {
              setError('');
              setChoosing(true);
            }}
          />
        }
      />
      <View style={s.intro}>
        <AppText style={s.eyebrow} color={colors.primaryInk}>
          RUN TOGETHER, TALK TOGETHER
        </AppText>
        <AppText color={colors.textMuted}>
          러닝 이야기도, 다음 약속도 여기서.
        </AppText>
      </View>
      {error ? (
        <Failure error={error} retry={() => setRevision(v => v + 1)} />
      ) : loading ? (
        <ActivityIndicator style={s.loader} color={colors.primary} />
      ) : (
        <FlatList
          data={rooms.filter(r => r.last_message_id)}
          keyExtractor={r => r.id}
          contentContainerStyle={s.list}
          ListEmptyComponent={
            <View style={s.empty}>
              <MessageSquare size={44} color={colors.primary} />
              <AppText variant="subheading">
                러너에게 첫 인사를 보내세요
              </AppText>
              <AppText align="center" color={colors.textMuted}>
                닉네임으로 찾아 1:1 대화를 시작할 수 있어요.
              </AppText>
              <Button
                size="md"
                label="새 대화 시작"
                onPress={() => {
                  setError('');
                  setChoosing(true);
                }}
              />
            </View>
          }
          renderItem={({ item }) => {
            const peer = item.members.find(uid => uid !== myUid())!;
            const unread = hasUnread(item, myUid());
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${
                  item.profiles[peer]?.display_name ?? '러너'
                } 대화${unread ? ', 새 메시지' : ''}`}
                onPress={() => setRoomId(item.id)}
                style={s.roomRow}
              >
                <Avatar profile={item.profiles[peer]} />
                <View style={s.grow}>
                  <AppText variant="subheading" numberOfLines={1}>
                    {item.profiles[peer]?.display_name ?? '러너'}
                  </AppText>
                  <AppText
                    numberOfLines={1}
                    color={unread ? colors.text : colors.textMuted}
                    style={unread ? s.unreadText : undefined}
                  >
                    {item.blocked_by.length ? '차단된 대화' : item.last_text}
                  </AppText>
                </View>
                <View style={s.roomMeta}>
                  <AppText variant="label" color={colors.textSubtle}>
                    {new Date(item.lastSentAt).toLocaleDateString('ko-KR', {
                      month: 'numeric',
                      day: 'numeric',
                    })}
                  </AppText>
                  {unread && <View style={s.unreadDot} />}
                </View>
              </Pressable>
            );
          }}
          ListFooterComponent={
            more ? (
              <Button
                label={loadingMore ? '불러오는 중…' : '이전 대화 더 보기'}
                variant="secondary"
                size="md"
                disabled={loadingMore}
                onPress={loadMore}
              />
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

function NewChat({
  onBack,
  onSelect,
  openError,
}: {
  onBack: () => void;
  onSelect: (uid: string) => void;
  openError: string;
}) {
  const [query, setQuery] = useState(''),
    [people, setPeople] = useState<PublicProfile[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState('');
  const request = useRef(0);
  useEffect(() => {
    const version = ++request.current;
    setPeople([]);
    setError('');
    if (!query.trim()) {
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    let live = true;
    const timer = setTimeout(() => {
      socialRequest<{ users: PublicProfile[] }>('search', {
        query: query.trim(),
      })
        .then(result => {
          if (live && version === request.current)
            setPeople(result.users.filter(p => p.uid !== myUid()));
        })
        .catch(e => {
          if (live && version === request.current) setError(chatError(e));
        })
        .finally(() => {
          if (live && version === request.current) setLoading(false);
        });
    }, 300);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query]);
  return (
    <SafeAreaView style={s.screen}>
      <Header title="새 대화" onBack={onBack} />
      {!!openError && (
        <AppText color={colors.danger} style={s.notice}>
          {openError}
        </AppText>
      )}
      <View style={s.search}>
        <Search size={20} color={colors.textMuted} />
        <TextInput
          autoFocus
          value={query}
          onChangeText={setQuery}
          maxLength={20}
          placeholder="러너 닉네임 검색"
          placeholderTextColor={colors.textSubtle}
          style={s.searchInput}
          accessibilityLabel="대화 상대 검색"
        />
      </View>
      {loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <FlatList
          data={people}
          keyExtractor={p => p.uid}
          contentContainerStyle={s.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <AppText align="center" color={colors.textMuted}>
              {error ||
                (query
                  ? '검색 결과가 없어요.'
                  : '대화할 러너의 닉네임을 입력해 주세요.')}
            </AppText>
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.display_name}에게 메시지`}
              onPress={() => onSelect(item.uid)}
              style={s.roomRow}
            >
              <Avatar profile={item} />
              <AppText variant="subheading">{item.display_name}</AppText>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

export function ConversationView({
  id,
  onBack,
}: {
  id: string;
  onBack: () => void;
}) {
  const uid = myUid();
  const [room, setRoom] = useState<Conversation | null>(null),
    [messages, setMessages] = useState<ChatMessage[]>([]),
    [body, setBody] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [sendError, setSendError] = useState(''),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0),
    [more, setMore] = useState(false),
    [loadingMore, setLoadingMore] = useState(false),
    [foreground, setForeground] = useState(AppState.currentState === 'active');
  const historyLoaded = useRef(false);
  const [atLatest, setAtLatest] = useState(true);
  const cursor = useRef<ChatCursor | null>(null),
    pending = useRef<{ id: string; text: string } | null>(null),
    sending = useRef(false),
    readRequest = useRef(''),
    list = useRef<FlatList<ChatMessage>>(null),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    const sub = AppState.addEventListener('change', state =>
      setForeground(state === 'active'),
    );
    return () => sub.remove();
  }, []);
  useEffect(() => {
    setError('');
    setLoading(true);
    const a = watchConversation(
      id,
      value => {
        setRoom(value);
        if (!value) setError('대화를 찾을 수 없어요.');
      },
      e => setError(chatError(e)),
    );
    const b = watchMessages(
      id,
      page => {
        setMessages(old =>
          mergeChatItems(old, page.items).sort(
            (x, y) => y.createdAt - x.createdAt || y.id.localeCompare(x.id),
          ),
        );
        if (!historyLoaded.current) {
          cursor.current = page.cursor;
          setMore(page.more);
        }
        setLoading(false);
      },
      e => {
        setError(chatError(e));
        setLoading(false);
      },
    );
    return () => {
      a();
      b();
    };
  }, [id, revision]);
  const newest = messages[0]?.id;
  useEffect(() => {
    if (
      !room?.last_message_id ||
      !foreground ||
      !atLatest ||
      newest !== room.last_message_id ||
      !hasUnread(room, uid) ||
      readRequest.current === room.last_message_id
    )
      return;
    const messageId = room.last_message_id;
    readRequest.current = messageId;
    markConversationRead(id, messageId).catch(() => {
      readRequest.current = '';
    });
  }, [room, uid, id, newest, foreground, atLatest]);
  const peer = room?.members.find(member => member !== uid),
    profile = peer ? room?.profiles[peer] : undefined,
    blocked = !!room?.blocked_by.length;
  const send = async () => {
    const value = body.trim();
    if (!value || sending.current || blocked || !room || loading || error)
      return;
    sending.current = true;
    setBusy(true);
    setSendError('');
    const attempt =
      pending.current?.text === value
        ? pending.current
        : { id: newMessageId(), text: value };
    pending.current = attempt;
    try {
      await sendMessage(id, attempt.id, value);
      if (alive.current) {
        setBody('');
        pending.current = null;
        list.current?.scrollToOffset({ offset: 0, animated: true });
      }
    } catch (e) {
      if (alive.current) setSendError(chatError(e));
    } finally {
      sending.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const loadMore = async () => {
    if (!cursor.current || loadingMore) return;
    setLoadingMore(true);
    historyLoaded.current = true;
    try {
      const page = await earlierMessages(id, cursor.current);
      if (alive.current) {
        setMessages(old =>
          mergeChatItems(old, page.items).sort(
            (a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id),
          ),
        );
        cursor.current = page.cursor;
        setMore(page.more);
      }
    } catch (e) {
      Alert.alert('메시지를 불러오지 못했어요', chatError(e));
    } finally {
      if (alive.current) setLoadingMore(false);
    }
  };
  const menu = () => {
    if (!room) return;
    const mine = room.blocked_by.includes(uid);
    Alert.alert(
      '대화 설정',
      mine
        ? '차단을 해제하면 다시 메시지를 주고받을 수 있어요.'
        : '차단하면 이 대화에서 서로 메시지를 보낼 수 없어요.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: mine ? '차단 해제' : '대화 차단',
          style: mine ? 'default' : 'destructive',
          onPress: () =>
            blockConversation(id, !mine).catch(e =>
              Alert.alert('처리하지 못했어요', chatError(e)),
            ),
        },
      ],
    );
  };
  return (
    <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
      <Header
        title={profile?.display_name ?? '대화'}
        onBack={onBack}
        right={
          <IconButton
            icon={MoreHorizontal}
            variant="plain"
            accessibilityLabel="대화 설정"
            onPress={menu}
          />
        }
      />
      <KeyboardAvoidingView
        style={s.grow}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {error ? (
          <Failure error={error} retry={() => setRevision(v => v + 1)} />
        ) : loading ? (
          <ActivityIndicator style={s.loader} color={colors.primary} />
        ) : messages.length === 0 ? (
          <View style={[s.grow, s.empty]}>
            <Avatar profile={profile} />
            <AppText variant="subheading">
              {profile?.display_name}님과의 대화
            </AppText>
            <AppText color={colors.textMuted}>
              러닝 이야기로 인사를 나눠 보세요.
            </AppText>
          </View>
        ) : (
          <FlatList
            ref={list}
            inverted
            onScroll={event =>
              setAtLatest(event.nativeEvent.contentOffset.y < 60)
            }
            scrollEventThrottle={150}
            data={messages}
            keyExtractor={m => m.id}
            contentContainerStyle={s.messageList}
            keyboardShouldPersistTaps="handled"
            maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
            ListFooterComponent={
              more ? (
                <Button
                  variant="secondary"
                  size="md"
                  label={loadingMore ? '불러오는 중…' : '이전 메시지 더 보기'}
                  disabled={loadingMore}
                  onPress={loadMore}
                />
              ) : null
            }
            renderItem={({ item, index }) => {
              const own = item.sender_uid === uid;
              const previous = messages[index + 1];
              const day = new Date(item.createdAt).toLocaleDateString('ko-KR', {
                month: 'long',
                day: 'numeric',
                weekday: 'short',
              });
              const showDay =
                !previous ||
                new Date(previous.createdAt).toDateString() !==
                  new Date(item.createdAt).toDateString();
              const read =
                own &&
                index === 0 &&
                peer &&
                (room?.read_at[peer] ?? 0) >= item.createdAt;
              return (
                <View>
                  {showDay && (
                    <AppText
                      align="center"
                      variant="label"
                      color={colors.textSubtle}
                      style={s.day}
                    >
                      {day}
                    </AppText>
                  )}
                  <View style={[s.messageRow, own && s.ownRow]}>
                    {!own && <Avatar profile={profile} />}
                    <View style={[s.bubble, own ? s.ownBubble : s.otherBubble]}>
                      <AppText
                        selectable
                        style={s.messageText}
                        color={colors.text}
                      >
                        {item.text}
                      </AppText>
                    </View>
                  </View>
                  <AppText
                    variant="label"
                    align={own ? 'right' : 'left'}
                    color={colors.textSubtle}
                    style={s.messageMeta}
                  >
                    {new Date(item.createdAt).toLocaleTimeString('ko-KR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {read ? ' · 읽음' : ''}
                  </AppText>
                </View>
              );
            }}
          />
        )}
        {blocked && (
          <AppText align="center" color={colors.textMuted} style={s.notice}>
            {room?.blocked_by.includes(uid)
              ? '내가 차단한 대화예요. 설정에서 해제할 수 있어요.'
              : '현재 메시지를 보낼 수 없는 대화예요.'}
          </AppText>
        )}
        {!!sendError && (
          <AppText
            accessibilityRole="alert"
            color={colors.danger}
            style={s.notice}
          >
            {sendError} 입력 내용은 유지돼요. 다시 전송해 주세요.
          </AppText>
        )}
        <View style={s.composer}>
          <TextInput
            multiline
            maxLength={2000}
            value={body}
            editable={!busy && !blocked && !error}
            onChangeText={setBody}
            placeholder={blocked ? '메시지를 보낼 수 없어요' : '메시지 보내기…'}
            placeholderTextColor={colors.textSubtle}
            accessibilityLabel="메시지 내용"
            style={s.input}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="메시지 전송"
            accessibilityState={{
              disabled:
                busy || blocked || !body.trim() || !room || !!error || loading,
            }}
            disabled={
              busy || blocked || !body.trim() || !room || !!error || loading
            }
            onPress={send}
            style={[
              s.send,
              (!body.trim() ||
                blocked ||
                busy ||
                !room ||
                !!error ||
                loading) &&
                s.disabled,
            ]}
          >
            {busy ? (
              <ActivityIndicator color="white" />
            ) : (
              <ArrowUp size={24} color="white" />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  grow: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    minHeight: 58,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: 8,
  },
  headerTitle: { flex: 1 },
  spacer: { width: 44 },
  intro: { padding: 24, gap: 9 },
  eyebrow: { fontFamily: fonts.semibold, fontSize: 9, letterSpacing: 1.4 },
  list: { padding: 20, gap: 8, flexGrow: 1 },
  empty: {
    padding: 24,
    gap: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  },
  loader: { flex: 1 },
  roomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  roomMeta: { alignItems: 'flex-end', gap: 10 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  unreadText: { fontFamily: fonts.semibold },
  search: {
    margin: 20,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: colors.surfaceMuted,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 15,
    minHeight: 48,
  },
  messageList: { paddingHorizontal: 20, paddingVertical: 16, flexGrow: 1 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  ownRow: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  ownBubble: {
    backgroundColor: colors.primarySoft,
    borderBottomRightRadius: 6,
  },
  otherBubble: {
    backgroundColor: colors.surfaceMuted,
    borderBottomLeftRadius: 6,
  },
  messageText: { fontSize: 15, lineHeight: 23 },
  messageMeta: { fontSize: 10, paddingVertical: 6, marginBottom: 8 },
  day: { paddingVertical: 14 },
  composer: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-end',
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 12,
    maxHeight: 120,
    minHeight: 48,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.text,
    textAlignVertical: 'center',
  },
  send: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
  notice: { padding: 12, fontSize: 12 },
});
