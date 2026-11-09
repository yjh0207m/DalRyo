import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  BackHandler,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePostAuthor } from '../../hooks/usePostAuthor';
import {
  ArrowUp,
  Ban,
  Check,
  ChevronLeft,
  ChevronRight,
  LogOut,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Search,
  UserRound,
  Users,
  X,
} from 'lucide-react-native';
import {
  ActionSheet,
  AppText,
  Button,
  IconButton,
  type ActionSheetItem,
} from '../../components/ui';
import { colors, fonts } from '../../theme';
import {
  myUid,
  socialError,
  socialRequest,
  type PublicProfile,
} from '../../services/social.service';
import {
  blockConversation,
  createGroupConversation,
  earlierConversations,
  earlierMessages,
  hasUnread,
  leaveGroupConversation,
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
  type InboxCursor,
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

function Avatar({
  profile,
  group = false,
  compact = false,
}: {
  profile?: ChatProfile;
  group?: boolean;
  compact?: boolean;
}) {
  return (
    <View style={[s.avatar, compact && s.avatarCompact]}>
      {group ? (
        <Users size={compact ? 17 : 23} color={colors.primaryInk} />
      ) : profile?.profile_image ? (
        <Image source={{ uri: profile.profile_image }} style={s.avatarImage} />
      ) : (
        <UserRound size={compact ? 17 : 23} color={colors.primaryInk} />
      )}
    </View>
  );
}
function conversationTitle(room: Conversation, uid: string) {
  if (room.kind !== 'group') {
    const peer = room.members.find(member => member !== uid);
    return (peer && room.profiles[peer]?.display_name) || '러너';
  }
  return (
    room.name ||
    room.members
      .filter(member => member !== uid)
      .map(member => room.profiles[member]?.display_name ?? '러너')
      .join(', ') ||
    '그룹 채팅'
  );
}

function Header({
  title,
  onBack,
  right,
  onTitlePress,
  subtitle,
  avatar,
  hideBack = false,
}: {
  title: string;
  onBack: () => void;
  right?: React.ReactNode;
  onTitlePress?: () => void;
  subtitle?: string;
  avatar?: React.ReactNode;
  // 서브 네비게이션으로 오가는 메시지 목록처럼 뒤로 가기 버튼이 필요 없을 때
  hideBack?: boolean;
}) {
  return (
    <View style={[s.header, hideBack && s.headerNoBack]}>
      {!hideBack && (
        <IconButton
          icon={ChevronLeft}
          variant="plain"
          accessibilityLabel="대화에서 뒤로"
          onPress={onBack}
        />
      )}
      <Pressable
        style={[s.headerTitle, !!avatar && s.headerIdentity]}
        disabled={!onTitlePress}
        accessibilityRole={onTitlePress ? 'button' : undefined}
        accessibilityLabel={onTitlePress ? `${title} 프로필 보기` : undefined}
        onPress={onTitlePress}
      >
        {avatar}
        <View style={s.grow}>
          <AppText
            variant={hideBack ? 'label' : 'subheading'}
            color={hideBack ? colors.textMuted : colors.text}
            numberOfLines={1}
          >
            {title}
          </AppText>
          {!!subtitle && (
            <AppText variant="label" color={colors.textMuted}>
              {subtitle}
            </AppText>
          )}
        </View>
      </Pressable>
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

type GroupDraft = { uids: string[]; name: string; requestId: string };

export function ChatScreen({
  onBack,
  initialPeer,
  onProfile,
  onTogether,
  onDetailChange,
  bottomInset = 0,
  hideBack = false,
}: {
  onBack: () => void;
  initialPeer?: string;
  onProfile?: (uid: string) => void;
  // 있으면 목록 맨 위에 "같이 달리기" 버튼을 보여 준다
  onTogether?: () => void;
  // 대화방이나 새 대화 화면처럼 목록 아래로 들어가 있는지 알린다. 부모가 하단 바를 가릴 때 쓴다
  onDetailChange?: (detail: boolean) => void;
  // 화면 아래에 떠 있는 바에 목록 끝이 가려지지 않도록 비워 둘 높이
  bottomInset?: number;
  // 목록 맨 위의 뒤로 가기 버튼을 숨긴다(시스템 뒤로 가기는 그대로 동작)
  hideBack?: boolean;
}) {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [opening, setOpening] = useState(!!initialPeer);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [choosing, setChoosing] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [rooms, setRooms] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [more, setMore] = useState(false);
  const leftRooms = useRef(new Set<string>());
  const openRequest = useRef(false);
  const detail = !!roomId || opening || choosing;
  useEffect(() => {
    onDetailChange?.(detail);
    return () => onDetailChange?.(false);
  }, [detail, onDetailChange]);
  const historyLoaded = useRef(false);
  const cursor = useRef<InboxCursor | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const open = useCallback(async (target: string | GroupDraft) => {
    if (openRequest.current) return;
    openRequest.current = true;
    setOpening(true);
    setError('');
    try {
      const id = await (typeof target === 'string'
        ? openConversation(target)
        : createGroupConversation(target.uids, target.name, target.requestId));
      if (alive.current) {
        setRoomId(id);
        setChoosing(false);
      }
    } catch (e) {
      if (alive.current) setError(chatError(e));
    } finally {
      openRequest.current = false;
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
          mergeChatItems(
            old.filter(item => !page.removedGroups?.includes(item.id)),
            page.items.filter(item => !leftRooms.current.has(item.id)),
          ).sort((a, b) => b.updatedAt - a.updatedAt),
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
      if (openRequest.current) return;
      if (creatingGroup) {
        setCreatingGroup(false);
        setError('');
        return;
      }
      setChoosing(false);
      setRevision(value => value + 1);
    } else onBack();
  }, [roomId, choosing, creatingGroup, initialPeer, onBack]);
  const onLeave = () => {
    if (!roomId || !alive.current) return;
    leftRooms.current.add(roomId);
    setRooms(old => old.filter(item => item.id !== roomId));
    setRoomId(current => (current === roomId ? null : current));
  };
  useBack(back);
  const loadMore = async () => {
    if (!cursor.current || loadingMore) return;
    setLoadingMore(true);
    historyLoaded.current = true;
    try {
      const page = await earlierConversations(cursor.current);
      if (alive.current) {
        setRooms(old =>
          mergeChatItems(
            old,
            page.items.filter(item => !leftRooms.current.has(item.id)),
          ).sort((a, b) => b.updatedAt - a.updatedAt),
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
    return (
      <ConversationView
        key={roomId}
        id={roomId}
        onBack={back}
        onProfile={onProfile}
        onLeave={onLeave}
      />
    );
  if (choosing)
    return (
      <NewChat
        key={creatingGroup ? 'group' : 'direct'}
        group={creatingGroup}
        onGroup={() => {
          setError('');
          setCreatingGroup(true);
        }}
        onBack={back}
        onSelect={open}
        openError={error}
        opening={opening}
      />
    );
  if (opening)
    return (
      <SafeAreaView style={s.screen}>
        <Header title="대화 열기" onBack={back} />
        <ActivityIndicator style={s.loader} color={colors.primary} />
      </SafeAreaView>
    );
  return (
    <SafeAreaView
      testID="chat-list"
      style={s.screen}
      edges={bottomInset ? ['top'] : ['top', 'bottom']}
    >
      <Header
        title="메시지"
        hideBack={hideBack}
        onBack={back}
        right={
          <IconButton
            icon={Plus}
            variant="plain"
            accessibilityLabel="새 대화"
            onPress={() => {
              setError('');
              setCreatingGroup(false);
              setChoosing(true);
            }}
          />
        }
      />
      {onTogether && (
        <View style={s.together}>
          <Button
            size="md"
            variant="secondary"
            icon={Users}
            label="같이 달리기"
            onPress={onTogether}
          />
        </View>
      )}
      {error ? (
        <Failure error={error} retry={() => setRevision(v => v + 1)} />
      ) : loading ? (
        <ActivityIndicator style={s.loader} color={colors.primary} />
      ) : (
        <FlatList
          data={rooms.filter(r => r.kind === 'group' || r.last_message_id)}
          keyExtractor={r => r.id}
          contentContainerStyle={[
            s.list,
            bottomInset ? { paddingBottom: bottomInset } : null,
          ]}
          ListEmptyComponent={
            <View style={s.empty}>
              <MessageSquare size={44} color={colors.primary} />
              <AppText variant="subheading">
                러너에게 첫 인사를 보내세요
              </AppText>
              <AppText align="center" color={colors.textMuted}>
                러너를 찾아 1:1 또는 그룹 대화를 시작해 보세요.
              </AppText>
              <Button
                size="md"
                label="새 대화 시작"
                onPress={() => {
                  setError('');
                  setCreatingGroup(false);
                  setChoosing(true);
                }}
              />
            </View>
          }
          renderItem={({ item }) => {
            const uid = myUid();
            const group = item.kind === 'group';
            const peer = item.members.find(member => member !== uid);
            const unread = hasUnread(item, uid);
            const title = conversationTitle(item, uid);
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${title} 대화${
                  unread ? ', 새 메시지' : ''
                }`}
                onPress={() => setRoomId(item.id)}
                style={s.roomRow}
              >
                {group || !peer ? (
                  <Avatar group={group} />
                ) : (
                  <ConversationAvatar room={item} uid={peer} />
                )}
                <View style={s.grow}>
                  <AppText variant="subheading" numberOfLines={1}>
                    {title}
                    {group && (
                      <AppText
                        variant="label"
                        color={colors.textMuted}
                      >{`  ${item.members.length}명`}</AppText>
                    )}
                  </AppText>
                  <AppText
                    numberOfLines={1}
                    color={unread ? colors.text : colors.textMuted}
                    style={unread ? s.unreadText : undefined}
                  >
                    {item.blocked_by.length
                      ? '차단된 대화'
                      : item.last_text || '아직 메시지가 없어요.'}
                  </AppText>
                </View>
                <View style={s.roomMeta}>
                  <AppText variant="label" color={colors.textSubtle}>
                    {new Date(
                      item.lastSentAt || item.updatedAt,
                    ).toLocaleDateString('ko-KR', {
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

// 새 대화 검색 결과 순서: 내가 팔로우한 사람 > 나를 팔로우한 사람 > 모르는 사람. 서버가 정렬해 주지만 앱도 같은 순서를 지킨다
const RELATION_RANK = { following: 0, follower: 1, none: 2 } as const;
const RELATION_LABEL = {
  following: '팔로잉',
  follower: '나를 팔로우',
  none: '',
};
export function byRelation(users: PublicProfile[]) {
  return users
    .map((user, index) => ({ user, index }))
    .sort(
      (a, b) =>
        RELATION_RANK[a.user.relation ?? 'none'] -
          RELATION_RANK[b.user.relation ?? 'none'] || a.index - b.index,
    )
    .map(item => item.user);
}

function ConversationAvatar({
  room,
  uid,
}: {
  room: Conversation;
  uid: string;
}) {
  const current = usePostAuthor(uid, room);
  return <Avatar profile={current ?? room.profiles[uid]} />;
}

function GroupMemberRow({
  room,
  member,
  currentUser,
  onProfile,
}: {
  room: Conversation;
  member: string;
  currentUser: string;
  onProfile?: (uid: string) => void;
}) {
  const current = usePostAuthor(member, room);
  const profile = current ?? room.profiles[member];
  const name = profile?.display_name ?? '러너';
  const canOpen = !!onProfile && member !== currentUser;
  return (
    <Pressable
      disabled={!canOpen}
      accessibilityRole={canOpen ? 'button' : undefined}
      accessibilityLabel={canOpen ? `${name} 프로필 보기` : undefined}
      onPress={() => onProfile?.(member)}
      style={s.roomRow}
    >
      <Avatar profile={profile} />
      <AppText variant="subheading" style={s.grow}>
        {member === currentUser ? `${name} (나)` : name}
      </AppText>
      {canOpen && <ChevronRight size={19} color={colors.textMuted} />}
    </Pressable>
  );
}

function GroupSender({ room, uid }: { room: Conversation; uid: string }) {
  const profile = usePostAuthor(uid, room) ?? room.profiles[uid];
  return (
    <View style={s.groupSender}>
      <Avatar profile={profile} compact />
      <AppText
        variant="label"
        color={colors.textMuted}
        numberOfLines={1}
        style={s.grow}
      >
        {profile?.display_name ?? '러너'}
      </AppText>
    </View>
  );
}

function NewChat({
  group,
  onGroup,
  onBack,
  onSelect,
  openError,
  opening,
}: {
  group: boolean;
  onGroup: () => void;
  onBack: () => void;
  onSelect: (target: string | GroupDraft) => void;
  openError: string;
  opening: boolean;
}) {
  const [query, setQuery] = useState(''),
    [people, setPeople] = useState<PublicProfile[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState('');
  const [selected, setSelected] = useState<PublicProfile[]>([]);
  const [name, setName] = useState('');
  const attempt = useRef<string | null>(null);
  const toggle = (person: PublicProfile) => {
    attempt.current = null;
    setSelected(old =>
      old.some(item => item.uid === person.uid)
        ? old.filter(item => item.uid !== person.uid)
        : old.length < 9
        ? [...old, person]
        : old,
    );
  };
  const create = () => {
    if (selected.length < 2 || opening) return;
    Keyboard.dismiss();
    attempt.current ??= newMessageId();
    onSelect({
      uids: selected.map(person => person.uid),
      name: name.trim(),
      requestId: attempt.current,
    });
  };
  const request = useRef(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [revision, setRevision] = useState(0);
  const paging = useRef(false);
  useEffect(() => {
    const version = ++request.current;
    setPeople([]);
    setError('');
    setNextCursor(null);
    setLoadingMore(false);
    paging.current = false;
    setLoading(true);
    let live = true;
    const timer = setTimeout(
      () => {
        const searching = !!query.trim();
        socialRequest<{ users: PublicProfile[]; cursor?: string | null }>(
          searching ? 'search' : 'connections',
          searching
            ? { query: query.trim() }
            : { uid: myUid(), kind: 'following' },
        )
          .then(result => {
            if (live && version === request.current) {
              setPeople(
                byRelation(result.users.filter(p => p.uid !== myUid())),
              );
              setNextCursor(searching ? null : result.cursor ?? null);
            }
          })
          .catch(e => {
            if (live && version === request.current) setError(chatError(e));
          })
          .finally(() => {
            if (live && version === request.current) setLoading(false);
          });
      },
      query.trim() ? 300 : 0,
    );
    return () => {
      live = false;
      request.current = version + 1;
      clearTimeout(timer);
    };
  }, [query, revision]);
  const loadMore = async () => {
    if (!nextCursor || paging.current || query.trim()) return;
    const version = request.current;
    paging.current = true;
    setLoadingMore(true);
    setError('');
    try {
      const page = await socialRequest<{
        users: PublicProfile[];
        cursor: string | null;
      }>('connections', {
        uid: myUid(),
        kind: 'following',
        cursor: nextCursor,
      });
      if (version !== request.current) return;
      setPeople(old => [
        ...new Map(
          [...old, ...page.users.filter(p => p.uid !== myUid())].map(p => [
            p.uid,
            p,
          ]),
        ).values(),
      ]);
      setNextCursor(page.cursor);
    } catch (e) {
      if (version === request.current) setError(chatError(e));
    } finally {
      if (version === request.current) {
        paging.current = false;
        setLoadingMore(false);
      }
    }
  };
  return (
    <SafeAreaView style={s.screen}>
      <KeyboardAvoidingView
        style={s.grow}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Header
          title={group ? '새 그룹 채팅' : '새 대화'}
          onBack={onBack}
          right={
            group ? (
              <Pressable
                accessibilityRole="button"
                disabled={selected.length < 2 || opening}
                accessibilityLabel="그룹 만들기"
                onPress={create}
                style={s.headerAction}
              >
                {opening ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <AppText
                    variant="label"
                    color={
                      selected.length < 2
                        ? colors.textSubtle
                        : colors.primaryAction
                    }
                  >
                    만들기
                  </AppText>
                )}
              </Pressable>
            ) : opening ? (
              <ActivityIndicator color={colors.primary} />
            ) : undefined
          }
        />
        {!!openError && (
          <AppText color={colors.danger} style={s.notice}>
            {openError}
          </AppText>
        )}
        {group ? (
          <>
            <TextInput
              value={name}
              onChangeText={value => {
                attempt.current = null;
                setName(value);
              }}
              editable={!opening}
              maxLength={40}
              placeholder="채팅방 이름 (선택)"
              placeholderTextColor={colors.textSubtle}
              accessibilityLabel="채팅방 이름"
              style={s.groupName}
            />
            <AppText
              variant="label"
              color={colors.textMuted}
              style={s.selectionLabel}
            >
              {`참여자 2~9명 선택 · ${selected.length}명 선택됨`}
            </AppText>
            {selected.length > 0 && (
              <View>
                <ScrollView
                  horizontal
                  keyboardShouldPersistTaps="handled"
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.selectedList}
                >
                  {selected.map(person => (
                    <Pressable
                      key={person.uid}
                      accessibilityRole="button"
                      accessibilityLabel={`${person.display_name} 선택 해제`}
                      disabled={opening}
                      onPress={() => toggle(person)}
                      style={s.personChip}
                    >
                      <AppText variant="label" color={colors.primaryInk}>
                        {person.display_name}
                      </AppText>
                      <X size={15} color={colors.primaryInk} />
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
          </>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="그룹 채팅 만들기"
            disabled={opening}
            onPress={onGroup}
            style={[s.roomRow, s.groupEntry]}
          >
            <Avatar group />
            <View style={s.grow}>
              <AppText variant="subheading">그룹 채팅 만들기</AppText>
              <AppText variant="caption" color={colors.textMuted}>
                러너 여러 명과 함께 대화해요
              </AppText>
            </View>
            <ChevronRight size={20} color={colors.textMuted} />
          </Pressable>
        )}
        <View style={s.search}>
          <Search size={20} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            editable={!opening}
            maxLength={21}
            placeholder="닉네임 또는 @아이디 검색"
            placeholderTextColor={colors.textSubtle}
            style={s.searchInput}
            accessibilityLabel="대화 상대 검색"
          />
        </View>
        <AppText variant="label" color={colors.textMuted} style={s.notice}>
          {query.trim() ? '검색 결과' : '내가 팔로우하는 러너'}
        </AppText>
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
                  (query.trim()
                    ? '검색 결과가 없어요.'
                    : '아직 팔로우한 러너가 없어요. 닉네임으로 검색해 보세요.')}
              </AppText>
            }
            ListFooterComponent={
              <View>
                {!!error && people.length > 0 && (
                  <AppText color={colors.danger}>{error}</AppText>
                )}
                {nextCursor ? (
                  <Button
                    label={loadingMore ? '불러오는 중…' : '더 보기'}
                    disabled={loadingMore}
                    onPress={loadMore}
                    variant="secondary"
                  />
                ) : error ? (
                  <Button
                    label="다시 시도"
                    onPress={() => setRevision(v => v + 1)}
                    variant="secondary"
                  />
                ) : null}
              </View>
            }
            renderItem={({ item }) => {
              const checked = selected.some(person => person.uid === item.uid);
              return (
                <Pressable
                  accessibilityRole={group ? 'checkbox' : 'button'}
                  accessibilityLabel={
                    group
                      ? item.display_name
                      : `${item.display_name}에게 메시지`
                  }
                  accessibilityState={group ? { checked } : undefined}
                  disabled={
                    opening || (group && !checked && selected.length >= 9)
                  }
                  onPress={() => (group ? toggle(item) : onSelect(item.uid))}
                  style={s.roomRow}
                >
                  <Avatar profile={item} />
                  <View style={s.grow}>
                    <AppText variant="subheading">{item.display_name}</AppText>
                    {!!RELATION_LABEL[item.relation ?? 'none'] && (
                      <AppText variant="caption" color={colors.textMuted}>
                        {RELATION_LABEL[item.relation ?? 'none']}
                      </AppText>
                    )}
                  </View>
                  {group && (
                    <View style={[s.check, checked && s.checked]}>
                      {checked && <Check size={15} color="white" />}
                    </View>
                  )}
                </Pressable>
              );
            }}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function ConversationView({
  id,
  onBack,
  onProfile,
  onLeave,
}: {
  id: string;
  onBack: () => void;
  onProfile?: (uid: string) => void;
  onLeave?: () => void;
}) {
  const uid = myUid();
  const { height: windowHeight } = useWindowDimensions();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const keyboardInset =
    Platform.OS === 'android'
      ? Math.max(
          0,
          keyboardHeight -
            Math.max(0, Dimensions.get('screen').height - windowHeight),
        )
      : 0;
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const leaving = useRef(false);
  const historyLoaded = useRef(false);
  const [atLatest, setAtLatest] = useState(true);
  const atLatestRef = useRef(true);
  const initialScroll = useRef(true);
  const pinToLatest = useRef(true);
  const scrollFrame = useRef<number | null>(null);
  const cursor = useRef<ChatCursor | null>(null),
    pending = useRef<{ id: string; text: string } | null>(null),
    sending = useRef(false),
    readRequest = useRef(''),
    list = useRef<FlatList<ChatMessage>>(null),
    alive = useRef(true);
  const scrollToLatest = useCallback(() => {
    if (scrollFrame.current !== null) cancelAnimationFrame(scrollFrame.current);
    scrollFrame.current = requestAnimationFrame(() => {
      scrollFrame.current = null;
      if (alive.current && pinToLatest.current)
        list.current?.scrollToEnd({ animated: false });
    });
  }, []);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (scrollFrame.current !== null)
        cancelAnimationFrame(scrollFrame.current);
    };
  }, []);
  useEffect(() => {
    const sub = AppState.addEventListener('change', state =>
      setForeground(state === 'active'),
    );
    return () => sub.remove();
  }, []);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', event => {
      pinToLatest.current = true;
      atLatestRef.current = true;
      setAtLatest(true);
      setKeyboardHeight(event.endCoordinates.height);
      scrollToLatest();
    });
    const hide = Keyboard.addListener('keyboardDidHide', () =>
      setKeyboardHeight(0),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, [scrollToLatest]);
  useEffect(() => {
    if (pinToLatest.current) scrollToLatest();
  }, [keyboardInset, keyboardHeight, windowHeight, scrollToLatest]);
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
  const chronological = useMemo(() => [...messages].reverse(), [messages]);
  useEffect(() => {
    if (
      !room?.last_message_id ||
      !!error ||
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
  }, [room, uid, id, newest, foreground, atLatest, error]);
  const groupRoom = room?.kind === 'group' ? room : null;
  const peer = groupRoom
    ? undefined
    : room?.members.find(member => member !== uid);
  const currentProfile = usePostAuthor(peer, room);
  const profile = currentProfile ?? (peer ? room?.profiles[peer] : undefined);
  const blocked = !!room?.blocked_by.length;
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
        setBody(current => (current.trim() === value ? '' : current));
        pending.current = null;
        pinToLatest.current = true;
        atLatestRef.current = true;
        setAtLatest(true);
        scrollToLatest();
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
    pinToLatest.current = false;
    atLatestRef.current = false;
    setAtLatest(false);
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
  const confirmBlock = () => {
    const mine = room?.blocked_by.includes(uid);
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
  const confirmLeave = () => {
    if (leaving.current) return;
    Alert.alert(
      '그룹 채팅방 나가기',
      '나가면 이 채팅방의 메시지를 더 이상 볼 수 없어요.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '나가기',
          style: 'destructive',
          onPress: async () => {
            if (leaving.current) return;
            leaving.current = true;
            try {
              await leaveGroupConversation(id);
              if (onLeave) onLeave();
              else if (alive.current) onBack();
            } catch (e) {
              if (alive.current)
                Alert.alert('채팅방을 나가지 못했어요', chatError(e));
            } finally {
              leaving.current = false;
            }
          },
        },
      ],
    );
  };
  const settings: ActionSheetItem[] = groupRoom
    ? [
        {
          label: `참여자 ${groupRoom.members.length}명 보기`,
          icon: Users,
          onPress: () => setMembersOpen(true),
        },
        {
          label: '채팅방 나가기',
          icon: LogOut,
          danger: true,
          onPress: confirmLeave,
        },
      ]
    : [
        ...(peer && onProfile
          ? [
              {
                label: '상대 프로필 보기',
                icon: UserRound,
                onPress: () => onProfile(peer),
              },
            ]
          : []),
        {
          label: room?.blocked_by.includes(uid)
            ? '대화 차단 해제'
            : '대화 차단',
          icon: Ban,
          danger: !room?.blocked_by.includes(uid),
          onPress: confirmBlock,
        },
      ];
  return (
    <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
      <Header
        title={
          groupRoom
            ? conversationTitle(groupRoom, uid)
            : profile?.display_name ?? '대화'
        }
        subtitle={
          groupRoom ? `그룹 채팅 · ${groupRoom.members.length}명` : undefined
        }
        avatar={
          room ? (
            <Avatar profile={profile} group={!!groupRoom} compact />
          ) : undefined
        }
        onBack={onBack}
        onTitlePress={peer && onProfile ? () => onProfile(peer) : undefined}
        right={
          <IconButton
            icon={MoreHorizontal}
            variant="plain"
            accessibilityLabel="대화 설정"
            disabled={!room}
            onPress={() => {
              Keyboard.dismiss();
              setSettingsOpen(true);
            }}
          />
        }
      />
      <KeyboardAvoidingView
        style={s.grow}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View
          testID="dm-keyboard-region"
          style={[s.grow, { paddingBottom: keyboardInset }]}
        >
          {error ? (
            <Failure error={error} retry={() => setRevision(v => v + 1)} />
          ) : loading ? (
            <ActivityIndicator style={s.loader} color={colors.primary} />
          ) : messages.length === 0 ? (
            <View style={[s.grow, s.empty]}>
              <Avatar profile={profile} group={!!groupRoom} />
              <AppText variant="subheading">
                {groupRoom
                  ? '첫 메시지를 보내 보세요'
                  : `${profile?.display_name ?? '러너'}님과의 대화`}
              </AppText>
              <AppText color={colors.textMuted}>
                러닝 이야기로 인사를 나눠 보세요.
              </AppText>
            </View>
          ) : (
            <FlatList
              ref={list}
              onLayout={scrollToLatest}
              onScrollBeginDrag={() => {
                pinToLatest.current = false;
              }}
              onScroll={event => {
                if (pinToLatest.current) return;
                const { contentOffset, layoutMeasurement, contentSize } =
                  event.nativeEvent;
                const latest =
                  contentOffset.y + layoutMeasurement.height >=
                  contentSize.height - 60;
                atLatestRef.current = latest;
                if (latest) pinToLatest.current = true;
                setAtLatest(latest);
              }}
              scrollEventThrottle={150}
              data={chronological}
              onContentSizeChange={() => {
                if (initialScroll.current || atLatestRef.current) {
                  initialScroll.current = false;
                  scrollToLatest();
                }
              }}
              keyExtractor={m => m.id}
              contentContainerStyle={s.messageList}
              keyboardShouldPersistTaps="handled"
              maintainVisibleContentPosition={
                atLatest ? undefined : { minIndexForVisible: 0 }
              }
              ListHeaderComponent={
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
                const previous = chronological[index - 1];
                const day = new Date(item.createdAt).toLocaleDateString(
                  'ko-KR',
                  {
                    month: 'long',
                    day: 'numeric',
                    weekday: 'short',
                  },
                );
                const showDay =
                  !previous ||
                  new Date(previous.createdAt).toDateString() !==
                    new Date(item.createdAt).toDateString();
                const readCount =
                  own &&
                  index === chronological.length - 1 &&
                  item.createdAt > 0
                    ? (room?.members ?? []).filter(
                        member =>
                          member !== uid &&
                          (room?.read_at[member] ?? 0) >= item.createdAt,
                      ).length
                    : 0;
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
                    {!own && groupRoom && (
                      <GroupSender room={groupRoom} uid={item.sender_uid} />
                    )}
                    <View
                      style={[
                        s.messageRow,
                        own ? s.ownRow : groupRoom && s.groupBubbleRow,
                      ]}
                    >
                      {!own && !groupRoom && <Avatar profile={profile} />}
                      <View
                        style={[s.bubble, own ? s.ownBubble : s.otherBubble]}
                      >
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
                      style={[
                        s.messageMeta,
                        !own && groupRoom && s.groupBubbleRow,
                      ]}
                    >
                      {new Date(item.createdAt).toLocaleTimeString('ko-KR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {readCount > 0
                        ? ` · 읽음${groupRoom ? ` ${readCount}` : ''}`
                        : ''}
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
              editable={!blocked && !error}
              onChangeText={setBody}
              placeholder={
                blocked ? '메시지를 보낼 수 없어요' : '메시지 보내기…'
              }
              placeholderTextColor={colors.textSubtle}
              accessibilityLabel="메시지 내용"
              style={s.input}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="메시지 전송"
              accessibilityState={{
                disabled:
                  busy ||
                  blocked ||
                  !body.trim() ||
                  !room ||
                  !!error ||
                  loading,
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
        </View>
      </KeyboardAvoidingView>
      <ActionSheet
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        items={settings}
      />
      {groupRoom && (
        <Modal
          visible={membersOpen}
          animationType="slide"
          onRequestClose={() => setMembersOpen(false)}
        >
          <SafeAreaView style={s.screen}>
            <Header
              title={`참여자 ${groupRoom.members.length}명`}
              onBack={() => setMembersOpen(false)}
            />
            <FlatList
              data={groupRoom.members}
              keyExtractor={member => member}
              contentContainerStyle={s.list}
              renderItem={({ item }) => (
                <GroupMemberRow
                  room={groupRoom}
                  member={item}
                  currentUser={uid}
                  onProfile={
                    onProfile
                      ? member => {
                          setMembersOpen(false);
                          onProfile(member);
                        }
                      : undefined
                  }
                />
              )}
            />
          </SafeAreaView>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  together: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 },
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
  // 탐색·내 프로필의 머리글과 같은 높이로 맞춘다
  headerNoBack: { paddingLeft: 20, minHeight: 48 },
  headerTitle: { flex: 1 },
  headerIdentity: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerAction: {
    minWidth: 58,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacer: { width: 44 },
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
  avatarCompact: { width: 30, height: 30, borderRadius: 15 },
  roomMeta: { alignItems: 'flex-end', gap: 10 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  unreadText: { fontFamily: fonts.semibold },
  groupEntry: { marginHorizontal: 20, paddingVertical: 12 },
  groupName: {
    marginHorizontal: 20,
    minHeight: 48,
    color: colors.text,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    fontFamily: fonts.regular,
    fontSize: 16,
  },
  selectionLabel: { marginHorizontal: 20, marginTop: 12 },
  selectedList: { paddingHorizontal: 20, paddingTop: 10, gap: 8 },
  personChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
  },
  check: {
    width: 23,
    height: 23,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checked: {
    backgroundColor: colors.primaryAction,
    borderColor: colors.primaryAction,
  },
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
  messageList: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  ownRow: { justifyContent: 'flex-end' },
  groupSender: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  groupBubbleRow: { marginLeft: 38 },
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
