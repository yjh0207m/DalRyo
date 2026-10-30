import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Bell,
  Footprints,
  MoreHorizontal,
  Settings,
  Bookmark,
  ChevronLeft,
  MessageSquare,
  MessageCircle,
  Pencil,
  Search,
  Share2,
  Trash2,
  Trophy,
  UserRound,
  Users,
  X,
} from 'lucide-react-native';
import { AppText, Button, Card, IconButton } from '../../components/ui';
import { RunningShoeIcon } from '../../components/ui/RunningShoeIcon';
import { ChatScreen } from './ChatScreen';
import { CommentsSheet } from './CommentsSheet';
import { hasUnread, watchConversations } from '../../services/chat.service';
import { TAB_BAR_HEIGHT } from '../../navigation/BottomTabBar';
import { colors, fonts, radius, spacing } from '../../theme';
import { useSocialFeed } from '../../hooks/useSocialFeed';
import { choosePhoto, uploadPhoto } from '../../services/media.service';
import { fetchRecentRuns } from '../../services/run.service';
import {
  myUid,
  newSocialId,
  savedPosts,
  socialError,
  socialRequest,
  watchPost,
  watchPostFlags,
  type FeedScope,
  type PublicProfile,
  type SocialPost,
} from '../../services/social.service';
import { formatDuration, formatPace } from '../../utils/pace';
import type { Asset } from 'react-native-image-picker';
import type { RunDocument } from '../../types/run.types';

type Props = {
  hasUnread?: boolean;
  onNotificationPress: () => void;
  onSettingsPress: () => void;
  // friendUid가 있으면 그 친구를 골라 둔 채로 같이 달리기 화면을 연다
  onTogetherPress?: (friendUid?: string) => void;
  onSubpageChange?: (open: boolean) => void;
};
type Route =
  | { page: 'feed' }
  | { page: 'compose'; post?: SocialPost }
  | { page: 'post'; id: string }
  | { page: 'profile'; uid: string }
  | { page: 'search' }
  | { page: 'rankings' }
  | { page: 'saved' }
  | { page: 'chat'; peer?: string };
const VISIBILITY = {
  public: '전체 공개',
  followers: '팔로워 공개',
  private: '나만 보기',
};

export function CommunityScreen(props: Props) {
  const [comments, setComments] = useState<{
    id: string;
    onProfile: (uid: string) => void;
  } | null>(null);
  return (
    <>
      <CommunityContent
        {...props}
        onComments={(id, onProfile) => setComments({ id, onProfile })}
      />
      {comments && (
        <CommentsSheet
          key={comments.id}
          postId={comments.id}
          onClose={() => setComments(null)}
          onProfile={comments.onProfile}
        />
      )}
    </>
  );
}

function CommunityContent(
  props: Props & {
    onComments: (id: string, onProfile: (uid: string) => void) => void;
  },
) {
  const [unreadChat, setUnreadChat] = useState(false);
  useEffect(
    () =>
      watchConversations(
        page =>
          setUnreadChat(page.items.some(room => hasUnread(room, myUid()))),
        () => setUnreadChat(false),
      ),
    [],
  );
  const [scope, setScope] = useState<FeedScope>('public');
  const [stack, setStack] = useState<Route[]>([{ page: 'feed' }]);
  const onSubpageChange = props.onSubpageChange;
  useEffect(() => {
    onSubpageChange?.(stack.length > 1);
    return () => onSubpageChange?.(false);
  }, [stack.length, onSubpageChange]);
  const feed = useSocialFeed(scope);
  const route = stack[stack.length - 1];
  const push = (next: Route) => setStack(old => [...old, next]);
  const back = () => setStack(old => (old.length > 1 ? old.slice(0, -1) : old));
  const showPost = (id: string) => push({ page: 'post', id });
  const showProfile = (uid: string) => push({ page: 'profile', uid });
  const showComments = (id: string) => props.onComments(id, showProfile);
  const changed = () => {
    feed.refresh();
  };
  if (route.page === 'chat')
    return <ChatScreen initialPeer={route.peer} onBack={back} />;
  if (route.page === 'compose')
    return (
      <Composer
        post={route.post}
        onBack={back}
        onSaved={() => {
          setScope('mine');
          setStack([{ page: 'feed' }]);
          feed.refresh();
        }}
      />
    );
  if (route.page === 'post')
    return (
      <PostDetail
        id={route.id}
        onComments={() => showComments(route.id)}
        onBack={back}
        onProfile={showProfile}
        onEdit={post => push({ page: 'compose', post })}
        onDeleted={() => {
          back();
          changed();
        }}
      />
    );
  if (route.page === 'profile')
    return (
      <ProfilePage
        uid={route.uid}
        onBack={back}
        onPost={showPost}
        onTogether={props.onTogetherPress}
        onComments={showComments}
        onMessage={uid => push({ page: 'chat', peer: uid })}
      />
    );
  if (route.page === 'search' || route.page === 'rankings')
    return (
      <PeoplePage
        ranking={route.page === 'rankings'}
        onBack={back}
        onProfile={showProfile}
      />
    );
  if (route.page === 'saved')
    return (
      <SavedPage
        onBack={back}
        onPost={showPost}
        onProfile={showProfile}
        onComments={showComments}
      />
    );
  return (
    <Page title="커뮤니티" feed>
      <View style={styles.feedHeader}>
        <View>
          <AppText style={styles.feedWordmark}>달료 클럽</AppText>
          <AppText style={styles.feedEyebrow} color={colors.primaryInk}>
            함께 달리는 이야기
          </AppText>
        </View>
        <View style={styles.headerActions}>
          <IconButton
            icon={Search}
            size={36}
            variant="surface"
            accessibilityLabel="러너 검색"
            onPress={() => push({ page: 'search' })}
          />
          <IconButton
            icon={MessageSquare}
            dot={unreadChat}
            size={36}
            variant="surface"
            accessibilityLabel="메시지"
            onPress={() => push({ page: 'chat' })}
          />
          <IconButton
            icon={Bell}
            size={36}
            variant="surface"
            dot={props.hasUnread}
            accessibilityLabel="알림"
            onPress={props.onNotificationPress}
          />
          <IconButton
            icon={Settings}
            size={36}
            variant="surface"
            accessibilityLabel="설정"
            onPress={props.onSettingsPress}
          />
        </View>
      </View>
      <View style={styles.tabs}>
        {(
          [
            ['public', '전체'],
            ['following', '팔로잉'],
            ['mine', '내 게시물'],
          ] as Array<[FeedScope, string]>
        ).map(([value, label]) => (
          <Tab
            key={value}
            label={label}
            selected={scope === value}
            onPress={() => setScope(value)}
          />
        ))}
      </View>
      <ScrollView
        style={styles.feedCanvas}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.feedContent}
        refreshControl={
          <RefreshControl
            refreshing={feed.status === 'loading'}
            onRefresh={feed.refresh}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.discoveryRow}>
          {props.onTogetherPress && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="같이 달리기"
              onPress={() => props.onTogetherPress?.()}
              style={styles.discovery}
            >
              <Users size={15} color={colors.primaryInk} />
              <AppText variant="label" color={colors.primaryInk}>
                같이 달리기
              </AppText>
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            onPress={() => push({ page: 'rankings' })}
            style={styles.discovery}
          >
            <Trophy size={15} color={colors.textMuted} />
            <AppText variant="label">러너 랭킹</AppText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => push({ page: 'saved' })}
            style={styles.discovery}
          >
            <Bookmark size={15} color={colors.textMuted} />
            <AppText variant="label">저장함</AppText>
          </Pressable>
        </View>
        <View style={styles.feedSectionHeading}>
          <View style={styles.grow}>
            <AppText variant="heading">
              {scope === 'mine'
                ? '나의 러닝 이야기'
                : scope === 'following'
                ? '팔로잉의 이야기'
                : '러닝 이야기'}
            </AppText>
            <AppText variant="label" color={colors.textMuted}>
              각자의 속도, 함께 나누는 한 걸음
            </AppText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="글쓰기"
            onPress={() => push({ page: 'compose' })}
            style={styles.writeButton}
          >
            <Pencil size={16} color={colors.primaryInk} />
            <AppText variant="label" color={colors.primaryInk}>
              글쓰기
            </AppText>
          </Pressable>
        </View>
        {feed.status === 'loading' ? (
          <Loading />
        ) : feed.status === 'error' ? (
          <Failure retry={feed.refresh} />
        ) : feed.posts.length === 0 ? (
          <Empty
            title={
              scope === 'following'
                ? '팔로잉 피드가 비어 있어요'
                : '아직 게시물이 없어요'
            }
            detail={
              scope === 'following'
                ? '러너를 검색해 팔로우해 보세요.'
                : '오늘의 달리기를 기록과 함께 나눠 보세요.'
            }
          />
        ) : (
          feed.posts.map(post => (
            <PostCard
              key={post.post_id}
              post={post}
              onComments={() => showComments(post.post_id)}
              onOpen={() => showPost(post.post_id)}
              onProfile={() => showProfile(post.uid)}
            />
          ))
        )}
        {feed.moreError && (
          <AppText color={colors.danger}>
            이전 글을 불러오지 못했어요. 다시 시도해 주세요.
          </AppText>
        )}
        {feed.more && (
          <Button
            label={feed.loadingMore ? '불러오는 중…' : '이전 글 더 보기'}
            variant="secondary"
            disabled={feed.loadingMore}
            onPress={feed.loadMore}
          />
        )}
      </ScrollView>
    </Page>
  );
}

function Page({
  title,
  onBack,
  children,
  feed = false,
}: {
  feed?: boolean;
  title: string;
  onBack?: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!onBack) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);
  return (
    <SafeAreaView
      style={[styles.screen, feed && styles.feedScreen]}
      edges={['top']}
    >
      <StatusBar barStyle="dark-content" />
      {onBack && (
        <View style={styles.header}>
          <IconButton
            icon={ChevronLeft}
            variant="plain"
            accessibilityLabel={`${title}에서 뒤로`}
            onPress={onBack}
          />
          <AppText variant="heading">{title}</AppText>
        </View>
      )}
      {children}
    </SafeAreaView>
  );
}
function Avatar({ uri, size = 44 }: { uri: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  return uri && !failed ? (
    <Image
      source={{ uri }}
      onError={() => setFailed(true)}
      style={{ width: size, height: size, borderRadius: size / 2 }}
    />
  ) : (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <UserRound size={size * 0.48} color={colors.primaryInk} />
    </View>
  );
}
function Tab({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.tab, selected && styles.selectedTab]}
    >
      <AppText
        variant="caption"
        color={selected ? colors.primaryInk : colors.textMuted}
      >
        {label}
      </AppText>
    </Pressable>
  );
}
function Loading() {
  return <ActivityIndicator style={styles.loading} color={colors.primary} />;
}
function Empty({ title, detail }: { title: string; detail: string }) {
  return (
    <Card style={styles.empty}>
      <AppText variant="subheading">{title}</AppText>
      <AppText color={colors.textMuted} align="center">
        {detail}
      </AppText>
    </Card>
  );
}
function Failure({ retry }: { retry: () => void }) {
  return (
    <Card style={styles.empty}>
      <AppText color={colors.danger}>불러오지 못했어요.</AppText>
      <Button size="md" label="다시 시도" variant="secondary" onPress={retry} />
    </Card>
  );
}
function Field(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      {...props}
      autoCorrect={false}
      placeholderTextColor={colors.textSubtle}
      style={[styles.input, props.style]}
    />
  );
}
function errorAlert(error: unknown) {
  Alert.alert('잠시만요', socialError(error));
}

export function PostCard({
  post,
  onOpen,
  onComments,
  onProfile,
  onEdit,
  onDeleted,
  detail = false,
}: {
  post: SocialPost;
  onOpen: () => void;
  onComments: () => void;
  onProfile: () => void;
  onEdit?: () => void;
  onDeleted?: () => void;
  detail?: boolean;
}) {
  const [flags, setFlags] = useState({ liked: false, saved: false });
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(
    () =>
      watchPostFlags(post.post_id, patch =>
        setFlags(old => ({ ...old, ...patch })),
      ),
    [post.post_id],
  );
  const toggle = async (kind: 'like' | 'bookmark') => {
    if (busy) return;
    setBusy(kind);
    const active = kind === 'like' ? !flags.liked : !flags.saved;
    try {
      await socialRequest(kind, { postId: post.post_id, active });
      setFlags(old => ({
        ...old,
        [kind === 'like' ? 'liked' : 'saved']: active,
      }));
    } catch (error) {
      errorAlert(error);
    } finally {
      setBusy(null);
    }
  };
  const remove = () =>
    Alert.alert('게시물을 삭제할까요?', '삭제한 게시물은 피드에서 사라져요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            setBusy('delete');
            await socialRequest('deletePost', { postId: post.post_id });
            onDeleted?.();
          } catch (error) {
            errorAlert(error);
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  const own = post.uid === myUid();
  const sharePost = () =>
    Share.share({
      message: `달료 · ${post.author_name}\n${post.text}${
        post.run_id ? `\n${post.distance_km?.toFixed(2)}km` : ''
      }`,
    }).catch(errorAlert);
  const menu = () =>
    Alert.alert('게시물', post.author_name, [
      { text: '게시물 보기', onPress: onOpen },
      { text: '프로필 보기', onPress: onProfile },
      { text: '취소', style: 'cancel' },
    ]);
  const postedDate = post.createdAtMs
    ? new Date(post.createdAtMs).toLocaleDateString('ko-KR', {
        month: 'long',
        day: 'numeric',
      })
    : '';
  const hasMedia = !!post.image_url || !!post.run_id;
  return (
    <View style={[styles.post, detail && styles.detailPost]}>
      <View style={styles.postHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${post.author_name} 프로필`}
          onPress={onProfile}
          style={styles.author}
        >
          <Avatar uri={post.author_image} size={36} />
          <View style={styles.grow}>
            <AppText variant="subheading" numberOfLines={1}>
              {post.author_name}
            </AppText>
            <AppText variant="label" color={colors.textMuted}>
              {post.run_id
                ? '함께 나눈 러닝 기록'
                : VISIBILITY[post.visibility]}
            </AppText>
          </View>
        </Pressable>
        {detail && own && onEdit && (
          <IconButton
            icon={Pencil}
            variant="plain"
            accessibilityLabel="게시물 수정"
            onPress={onEdit}
          />
        )}
        {detail && own && (
          <IconButton
            icon={Trash2}
            variant="plain"
            accessibilityLabel="게시물 삭제"
            disabled={!!busy}
            onPress={remove}
          />
        )}
        {!detail && (
          <IconButton
            icon={MoreHorizontal}
            variant="plain"
            accessibilityLabel="게시물 메뉴"
            onPress={menu}
          />
        )}
      </View>
      <Pressable
        accessibilityRole={detail ? undefined : 'button'}
        accessibilityLabel="게시물 상세 보기"
        disabled={detail}
        onPress={onOpen}
      >
        {post.image_url ? (
          <Image
            source={{ uri: post.image_url }}
            resizeMode="cover"
            style={styles.feedPhoto}
          />
        ) : post.run_id ? (
          <View style={styles.runTile}>
            <View style={styles.runTileTop}>
              <Footprints size={20} color={colors.primaryInk} />
              <AppText variant="label" color={colors.primaryInk}>
                MY RUNNING LOG
              </AppText>
            </View>
            <View style={styles.runTileDistance}>
              <AppText style={styles.runTileNumber}>
                {(post.distance_km ?? 0).toFixed(2)}
              </AppText>
              <AppText variant="heading" color={colors.primaryInk}>
                km
              </AppText>
            </View>
            <AppText color={colors.primaryInk}>
              나의 속도로 채운 오늘의 한 걸음.
            </AppText>
            <AppText variant="caption" color={colors.primaryInk}>
              {formatPace(post.avg_pace_sec ?? 0)} /km · {post.calories ?? 0}{' '}
              kcal
            </AppText>
          </View>
        ) : (
          <View style={styles.textPost}>
            <AppText
              style={styles.textPostBody}
              numberOfLines={detail ? undefined : 5}
            >
              {post.text}
            </AppText>
          </View>
        )}
        {!!post.image_url && !!post.run_id && (
          <View style={styles.attachedRun}>
            <Footprints color={colors.primaryInk} size={16} />
            <AppText variant="caption" color={colors.primaryInk}>
              {(post.distance_km ?? 0).toFixed(2)} km ·{' '}
              {formatPace(post.avg_pace_sec ?? 0)} /km
            </AppText>
          </View>
        )}
      </Pressable>
      <View style={styles.postActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="응원"
          accessibilityState={{ selected: flags.liked, disabled: !!busy }}
          disabled={!!busy}
          onPress={() => toggle('like')}
          style={styles.socialIcon}
        >
          <RunningShoeIcon
            size={28}
            color={flags.liked ? colors.primary : colors.text}
            active={flags.liked}
          />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="댓글 보기"
          onPress={onComments}
          style={styles.socialIcon}
        >
          <MessageCircle size={25} color={colors.text} strokeWidth={1.8} />
        </Pressable>
        {post.visibility === 'public' && (
          <IconButton
            icon={Share2}
            variant="plain"
            accessibilityLabel="게시물 공유"
            onPress={sharePost}
          />
        )}
        <View style={styles.grow} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={flags.saved ? '저장 취소' : '게시물 저장'}
          accessibilityState={{ selected: flags.saved, disabled: !!busy }}
          disabled={!!busy}
          onPress={() => toggle('bookmark')}
          style={styles.socialIcon}
        >
          <Bookmark
            size={25}
            color={flags.saved ? colors.primaryInk : colors.text}
            fill={flags.saved ? colors.primarySoft : 'none'}
            strokeWidth={1.8}
          />
        </Pressable>
      </View>
      <View style={styles.postCaption}>
        <AppText variant="label">
          {post.like_count > 0
            ? `응원 ${post.like_count}개`
            : '첫 응원을 보내보세요'}
        </AppText>
        {hasMedia && !!post.text && (
          <Pressable
            accessibilityRole={detail ? undefined : 'button'}
            disabled={detail}
            onPress={onOpen}
          >
            <AppText
              style={styles.captionText}
              numberOfLines={detail ? undefined : 3}
              selectable={detail}
            >
              <AppText variant="subheading">{post.author_name} </AppText>
              {post.text}
            </AppText>
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="댓글 모두 보기"
          onPress={onComments}
        >
          <AppText variant="caption" color={colors.textMuted}>
            {post.comment_count > 0
              ? `댓글 ${post.comment_count}개 모두 보기`
              : '댓글로 응원을 남겨 보세요'}
          </AppText>
        </Pressable>
        <AppText style={styles.postDate} color={colors.textMuted}>
          {postedDate}
          {post.visibility !== 'public'
            ? ` · ${VISIBILITY[post.visibility]}`
            : ''}
        </AppText>
      </View>
    </View>
  );
}

function Composer({
  post,
  onBack,
  onSaved,
}: {
  post?: SocialPost;
  onBack: () => void;
  onSaved: () => void;
}) {
  const [body, setBody] = useState(post?.text ?? '');
  const [visibility, setVisibility] = useState<SocialPost['visibility']>(
    post?.visibility ?? 'public',
  );
  const [photo, setPhoto] = useState<Asset | null>(null);
  const [runs, setRuns] = useState<RunDocument[]>([]);
  const [runsStatus, setRunsStatus] = useState<'loading' | 'success' | 'error'>(
    'loading',
  );
  const [runId, setRunId] = useState<string | null>(post?.run_id ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [percent, setPercent] = useState(0);
  const [postId] = useState(() => post?.post_id ?? newSocialId());
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );
  const loadRuns = useCallback(() => {
    setRunsStatus('loading');
    fetchRecentRuns()
      .then(items => {
        if (mounted.current) {
          setRuns(items);
          setRunsStatus('success');
        }
      })
      .catch(() => {
        if (mounted.current) setRunsStatus('error');
      });
  }, []);
  useEffect(() => {
    if (!post) loadRuns();
  }, [post, loadRuns]);
  const dirty =
    body !== (post?.text ?? '') ||
    visibility !== (post?.visibility ?? 'public') ||
    !!photo ||
    runId !== (post?.run_id ?? null);
  const leave = () => {
    if (busy) return;
    if (!dirty) {
      onBack();
      return;
    }
    Alert.alert('작성 중인 내용이 있어요', '저장하지 않고 나갈까요?', [
      { text: '계속 작성', style: 'cancel' },
      { text: '나가기', style: 'destructive', onPress: onBack },
    ]);
  };
  const selectPhoto = async (camera: boolean) => {
    if (busy) return;
    try {
      const selected = await choosePhoto(camera);
      if (selected) setPhoto(selected);
    } catch (failure) {
      setError(socialError(failure));
    }
  };
  const submit = async () => {
    if (busy) return;
    if (!body.trim() && !photo && !runId && !post?.image_url) {
      setError('내용이나 사진, 달리기 기록을 추가해 주세요.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (post)
        await socialRequest('editPost', {
          postId,
          text: body.trim(),
          visibility,
        });
      else {
        const uploaded = photo
          ? await uploadPhoto(photo, 'posts', setPercent)
          : null;
        await socialRequest('createPost', {
          postId,
          text: body.trim(),
          visibility,
          imageUrl: uploaded?.url ?? null,
          runId,
        });
      }
      onSaved();
    } catch (failure) {
      setError(socialError(failure));
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  return (
    <Page title={post ? '게시물 수정' : '오늘의 달리기'} onBack={leave}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <Field
          accessibilityLabel="게시물 내용"
          placeholder="오늘 달리기는 어땠나요? #오운완"
          value={body}
          onChangeText={setBody}
          multiline
          maxLength={2000}
          editable={!busy}
          style={styles.composer}
        />
        <AppText variant="label" color={colors.textSubtle} align="right">
          {body.length}/2000
        </AppText>
        {(photo?.uri || post?.image_url) && (
          <Image
            source={{ uri: photo?.uri ?? post!.image_url! }}
            style={styles.postImage}
          />
        )}
        {!post && (
          <>
            <View style={styles.tabs}>
              <Button
                label="사진 선택"
                size="md"
                variant="secondary"
                disabled={busy}
                onPress={() => selectPhoto(false)}
                style={styles.grow}
              />
              <Button
                label="사진 촬영"
                size="md"
                variant="secondary"
                disabled={busy}
                onPress={() => selectPhoto(true)}
                style={styles.grow}
              />
              {photo && (
                <IconButton
                  icon={X}
                  accessibilityLabel="첨부 사진 제거"
                  disabled={busy}
                  onPress={() => setPhoto(null)}
                />
              )}
            </View>
            <AppText variant="subheading">달리기 기록 첨부</AppText>
            {runsStatus === 'loading' ? (
              <Loading />
            ) : runsStatus === 'error' ? (
              <Failure retry={loadRuns} />
            ) : runs.length === 0 ? (
              <AppText color={colors.textMuted}>
                저장한 달리기 기록이 없어요.
              </AppText>
            ) : (
              runs.map(run => (
                <Pressable
                  key={run.run_id}
                  accessibilityRole="radio"
                  accessibilityState={{
                    selected: runId === run.run_id,
                    disabled: busy,
                  }}
                  disabled={busy}
                  onPress={() =>
                    setRunId(old => (old === run.run_id ? null : run.run_id))
                  }
                  style={[
                    styles.runChoice,
                    runId === run.run_id && styles.selectedTab,
                  ]}
                >
                  <AppText>
                    {run.distance_km.toFixed(2)}km ·{' '}
                    {formatDuration(run.duration_sec)}
                  </AppText>
                </Pressable>
              ))
            )}
          </>
        )}
        <AppText variant="subheading">공개 범위</AppText>
        <View style={styles.tabs}>
          {(
            Object.entries(VISIBILITY) as Array<
              [SocialPost['visibility'], string]
            >
          ).map(([value, label]) => (
            <Tab
              key={value}
              label={label}
              selected={visibility === value}
              onPress={() => {
                if (!busy) setVisibility(value);
              }}
            />
          ))}
        </View>
        {error && (
          <AppText color={colors.danger} accessibilityRole="alert">
            {error}
          </AppText>
        )}
        {busy && photo && (
          <AppText variant="caption">사진 업로드 {percent}%</AppText>
        )}
        <Button
          label={busy ? '저장 중…' : post ? '수정 저장' : '게시물 올리기'}
          disabled={busy}
          onPress={submit}
        />
      </ScrollView>
    </Page>
  );
}

function PostDetail({
  id,
  onBack,
  onProfile,
  onComments,
  onEdit,
  onDeleted,
}: {
  id: string;
  onBack: () => void;
  onProfile: (uid: string) => void;
  onComments: () => void;
  onEdit: (post: SocialPost) => void;
  onDeleted: () => void;
}) {
  const [post, setPost] = useState<SocialPost | null>(null);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    'loading',
  );
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    setStatus('loading');
    return watchPost(
      id,
      value => {
        setPost(value);
        setStatus('success');
      },
      () => setStatus('error'),
    );
  }, [id, revision]);
  return (
    <Page title="게시물" onBack={onBack}>
      <ScrollView contentContainerStyle={styles.content}>
        {status === 'loading' ? (
          <Loading />
        ) : status === 'error' ? (
          <Failure retry={() => setRevision(v => v + 1)} />
        ) : !post ? (
          <Empty
            title="게시물을 볼 수 없어요"
            detail="삭제됐거나 공개 범위가 변경됐을 수 있어요."
          />
        ) : (
          <PostCard
            post={post}
            detail
            onOpen={() => {}}
            onComments={onComments}
            onProfile={() => onProfile(post.uid)}
            onEdit={() => onEdit(post)}
            onDeleted={onDeleted}
          />
        )}
      </ScrollView>
    </Page>
  );
}

function PeoplePage({
  ranking,
  onBack,
  onProfile,
}: {
  ranking: boolean;
  onBack: () => void;
  onProfile: (uid: string) => void;
}) {
  const [name, setName] = useState('');
  const [users, setUsers] = useState<PublicProfile[]>([]);
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');
  const epoch = useRef(0);
  useEffect(
    () => () => {
      epoch.current++;
    },
    [],
  );
  const load = useCallback(async () => {
    const key = ++epoch.current;
    setStatus('loading');
    try {
      const result = await socialRequest<{ users: PublicProfile[] }>(
        ranking ? 'rankings' : 'search',
        { query: name.trim() },
      );
      if (key === epoch.current) {
        setUsers(result.users);
        setStatus('success');
      }
    } catch {
      if (key === epoch.current) setStatus('error');
    }
  }, [name, ranking]);
  useEffect(() => {
    if (ranking) load();
  }, [ranking, load]);
  return (
    <Page title={ranking ? '누적 거리 TOP 50' : '러너 검색'} onBack={onBack}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        {!ranking && (
          <>
            <Field
              accessibilityLabel="러너 닉네임 검색"
              placeholder="닉네임 앞부분으로 검색"
              value={name}
              onChangeText={setName}
              maxLength={20}
            />
            <Button
              label="검색"
              size="md"
              disabled={!name.trim() || status === 'loading'}
              onPress={load}
            />
          </>
        )}
        {status === 'loading' ? (
          <Loading />
        ) : status === 'error' ? (
          <Failure retry={load} />
        ) : status === 'success' && users.length === 0 ? (
          <Empty
            title="러너를 찾지 못했어요"
            detail="닉네임을 다시 확인해 주세요."
          />
        ) : (
          users.map((person, index) => (
            <Pressable
              key={person.uid}
              accessibilityRole="button"
              onPress={() => onProfile(person.uid)}
              style={styles.person}
            >
              {ranking && <AppText variant="subheading">{index + 1}</AppText>}
              <Avatar uri={person.profile_image} />
              <View style={styles.grow}>
                <AppText variant="subheading">{person.display_name}</AppText>
                <AppText variant="caption" color={colors.textMuted}>
                  {person.region} · {person.total_km.toFixed(1)}km
                </AppText>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </Page>
  );
}
function ProfilePage({
  uid,
  onBack,
  onPost,
  onTogether,
  onComments,
  onMessage,
}: {
  uid: string;
  onBack: () => void;
  onPost: (id: string) => void;
  onTogether?: (friendUid: string) => void;
  onMessage: (uid: string) => void;
  onComments: (id: string) => void;
}) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [following, setFollowing] = useState(false);
  const [friend, setFriend] = useState(false);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    'loading',
  );
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let live = true;
    setStatus('loading');
    Promise.all([
      socialRequest<{
        profile: PublicProfile;
        following: boolean;
        friend?: boolean;
      }>('profile', {
        uid,
      }),
      socialRequest<{ posts: SocialPost[] }>('profilePosts', { uid }),
    ])
      .then(([data, feed]) => {
        if (live) {
          setProfile(data.profile);
          setFollowing(data.following);
          setFriend(data.friend === true);
          setPosts(feed.posts);
          setStatus('success');
        }
      })
      .catch(() => {
        if (live) setStatus('error');
      });
    return () => {
      live = false;
    };
  }, [uid, revision]);
  const follow = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await socialRequest('follow', { uid, following: !following });
      setFollowing(v => !v);
      setRevision(v => v + 1);
    } catch (error) {
      errorAlert(error);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page title="러너 프로필" onBack={onBack}>
      <ScrollView contentContainerStyle={styles.content}>
        {status === 'loading' ? (
          <Loading />
        ) : status === 'error' ? (
          <Failure retry={() => setRevision(v => v + 1)} />
        ) : (
          profile && (
            <>
              <Card style={styles.empty}>
                <Avatar uri={profile.profile_image} size={80} />
                <AppText variant="heading">{profile.display_name}</AppText>
                <AppText color={colors.textMuted}>
                  {profile.region} · 누적 {profile.total_km.toFixed(1)}km
                </AppText>
                <AppText variant="caption">
                  팔로워 {profile.follower_count} · 팔로잉{' '}
                  {profile.following_count}
                </AppText>
                {uid !== myUid() && (
                  <Button
                    label={following ? '팔로잉' : '팔로우'}
                    size="md"
                    variant={following ? 'secondary' : 'primary'}
                    disabled={busy}
                    onPress={follow}
                  />
                )}
                {uid !== myUid() && (
                  <Button
                    icon={MessageSquare}
                    label="메시지 보내기"
                    size="md"
                    variant="secondary"
                    onPress={() => onMessage(uid)}
                  />
                )}
                {friend && onTogether && (
                  <Button
                    label="같이 달리기 요청"
                    size="md"
                    disabled={busy}
                    onPress={() => onTogether(uid)}
                  />
                )}
              </Card>
              <AppText variant="subheading">최근 게시물</AppText>
              {posts.length === 0 ? (
                <Empty
                  title="공개된 글이 없어요"
                  detail="볼 수 있는 최근 게시물이 없습니다."
                />
              ) : (
                posts.map(post => (
                  <PostCard
                    key={post.post_id}
                    post={post}
                    onComments={() => onComments(post.post_id)}
                    onOpen={() => onPost(post.post_id)}
                    onProfile={() => {}}
                  />
                ))
              )}
            </>
          )
        )}
      </ScrollView>
    </Page>
  );
}
function SavedPage({
  onBack,
  onPost,
  onProfile,
  onComments,
}: {
  onBack: () => void;
  onPost: (id: string) => void;
  onProfile: (uid: string) => void;
  onComments: (id: string) => void;
}) {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    'loading',
  );
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let live = true;
    setStatus('loading');
    savedPosts()
      .then(items => {
        if (live) {
          setPosts(items);
          setStatus('success');
        }
      })
      .catch(() => {
        if (live) setStatus('error');
      });
    return () => {
      live = false;
    };
  }, [revision]);
  return (
    <Page title="저장한 게시물" onBack={onBack}>
      <ScrollView contentContainerStyle={styles.content}>
        {status === 'loading' ? (
          <Loading />
        ) : status === 'error' ? (
          <Failure retry={() => setRevision(v => v + 1)} />
        ) : posts.length === 0 ? (
          <Empty
            title="저장한 글이 없어요"
            detail="마음에 드는 글의 책갈피를 눌러 보세요."
          />
        ) : (
          posts.map(post => (
            <PostCard
              key={post.post_id}
              post={post}
              onComments={() => onComments(post.post_id)}
              onOpen={() => onPost(post.post_id)}
              onProfile={() => onProfile(post.uid)}
            />
          ))
        )}
      </ScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  content: { padding: spacing.xl, paddingBottom: 60, gap: spacing.md },
  feedCanvas: { backgroundColor: colors.background },
  feedContent: { paddingBottom: TAB_BAR_HEIGHT + 40 },
  feedSectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 16,
  },
  writeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    minHeight: 38,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primaryBorder,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: spacing.md,
  },
  grow: { flex: 1 },
  togetherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.primarySoft,
    padding: 18,
    borderRadius: radius.lg,
    marginTop: 4,
    marginBottom: 20,
  },
  togetherIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dim: { opacity: 0.75 },
  section: { marginVertical: spacing.md },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    gap: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  selectedTab: { borderBottomColor: colors.primary },
  loading: { marginVertical: 40 },
  empty: {
    alignItems: 'center',
    gap: spacing.md,
    marginVertical: spacing.md,
    paddingVertical: 32,
    paddingHorizontal: 20,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  avatar: {
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  post: {
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginBottom: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 24,
    overflow: 'hidden',
    paddingBottom: 18,
  },
  detailPost: {
    marginHorizontal: 0,
    marginBottom: 0,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  feedScreen: { backgroundColor: colors.sky },
  feedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
    gap: 8,
  },
  feedWordmark: {
    fontFamily: fonts.extrabold,
    fontSize: 25,
    lineHeight: 32,
    letterSpacing: -0.8,
  },
  feedEyebrow: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 4,
  },
  headerActions: { flexDirection: 'row', gap: 4 },
  discoveryRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
    backgroundColor: colors.surface,
    marginBottom: 22,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  discovery: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    flex: 1,
    paddingHorizontal: 8,
    minHeight: 40,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  feedPhoto: { width: '100%', aspectRatio: 1 },
  postActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 4,
    gap: 4,
  },
  socialIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postCaption: { paddingHorizontal: 18, gap: 7 },
  captionText: { fontSize: 14, lineHeight: 21 },
  postDate: { fontSize: 10, lineHeight: 15, marginTop: 2 },
  runTile: {
    padding: 28,
    gap: 16,
    backgroundColor: colors.primarySoft,
    minHeight: 250,
  },
  runTileTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  runTileDistance: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  runTileNumber: {
    fontFamily: fonts.extrabold,
    fontSize: 62,
    lineHeight: 74,
    color: colors.primaryInk,
    letterSpacing: -2,
  },
  attachedRun: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 11,
    backgroundColor: colors.primarySoft,
  },
  textPost: {
    marginHorizontal: 16,
    backgroundColor: colors.primarySoft,
    borderRadius: 20,
    padding: 24,
    minHeight: 145,
    justifyContent: 'center',
  },
  textPostBody: {
    fontFamily: fonts.semibold,
    fontSize: 21,
    lineHeight: 31,
    letterSpacing: -0.3,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  author: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  postImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.md,
    marginTop: spacing.md,
  },
  postText: { marginTop: spacing.md, lineHeight: 24 },
  runSummary: {
    padding: spacing.md,
    marginTop: spacing.md,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 16,
    backgroundColor: colors.surface,
    minHeight: 48,
  },
  composer: { minHeight: 160, textAlignVertical: 'top' },
  runChoice: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  comment: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  reply: { marginLeft: spacing.lg },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
