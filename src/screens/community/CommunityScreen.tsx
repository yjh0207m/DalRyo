import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
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
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {
  Footprints,
  MoreHorizontal,
  Bookmark,
  ChevronLeft,
  MessageCircle,
  MessageSquare,
  Pencil,
  Search,
  Share2,
  Trash2,
  Trophy,
  UserRound,
  Users,
  X,
  LayoutGrid,
  List,
} from 'lucide-react-native';
import {
  AppText,
  Button,
  Card,
  FullPhoto,
  IconButton,
  ScreenHeader,
} from '../../components/ui';
import { RunningShoeIcon } from '../../components/ui/RunningShoeIcon';
import { SlideScreen } from '../../navigation/slide';
import { ChatScreen } from './ChatScreen';
import { CommentsSheet } from './CommentsSheet';
import { ConnectionsScreen, type ConnectionKind } from './ConnectionsScreen';
import { CommunitySubNav, ROW_HEIGHT, type SubNavKey } from './CommunitySubNav';
import { CharacterView } from '../../components/character/CharacterView';
import {
  CHARACTER_TYPES,
  CHARACTER_STAGE_ORDER,
} from '../../types/character.types';
import { hasUnread, watchConversations } from '../../services/chat.service';
import {
  TAB_BAR_BODY_HEIGHT,
  TAB_BAR_HEIGHT,
  tabBarBottom,
} from '../../navigation/BottomTabBar';
import { colors, fonts, radius, spacing } from '../../theme';
import { useServerFeed } from '../../hooks/useServerFeed';
import { usePostAuthor } from '../../hooks/usePostAuthor';
import { choosePhoto, uploadPhoto } from '../../services/media.service';
import { runInBackground } from '../../services/backgroundTask.service';
import { fetchRecentRuns } from '../../services/run.service';
import {
  myUid,
  newSocialId,
  savedPosts,
  socialError,
  socialRequest,
  watchPost,
  watchPostFlags,
  type PublicProfile,
  type SocialPost,
  type RunnerProfile,
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
  // 알림에서 넘어올 때 피드 위에 바로 열어 둘 게시물이나 프로필. 뒤로 가면 피드로 돌아온다
  initialRoute?: CommunityLink;
  // initialRoute를 처음 화면에 반영한 뒤 부른다. 부모가 그 값을 지워 다시 열리지 않게 한다
  onInitialRouteHandled?: () => void;
};
export type CommunityLink =
  | { page: 'post'; id: string }
  | { page: 'profile'; uid: string }
  // 설정의 "저장한 게시물"에서 넘어올 때
  | { page: 'saved' };
type Route =
  | { page: 'feed' }
  | { page: 'compose'; post?: SocialPost }
  | { page: 'post'; id: string }
  | { page: 'profile'; uid: string }
  | { page: 'connections'; uid: string; kind: ConnectionKind }
  | { page: 'search' }
  | { page: 'rankings' }
  | { page: 'saved' }
  | { page: 'chat'; peer?: string };
const WRITE_SIZE = 52;
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
  const insets = useSafeAreaInsets();
  const feedScroll = useRef<ScrollView>(null);
  // 서브 네비게이션이 고르는 커뮤니티 안의 큰 화면. 하단 바 두 개는 그대로 두고 이 영역만 바뀐다
  const [section, setSection] = useState<SubNavKey>('feed');
  const [chatDetail, setChatDetail] = useState(false);
  // 서브 네비게이션의 펼침 정도. 글쓰기 버튼이 같은 값으로 움직여서 메뉴와 동시에 비켜 준다
  const subNavProgress = useRef(new Animated.Value(0)).current;
  const writeLift = subNavProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -(ROW_HEIGHT + 12)],
  });
  const [stack, setStack] = useState<Route[]>(() =>
    props.initialRoute
      ? [{ page: 'feed' }, props.initialRoute]
      : [{ page: 'feed' }],
  );
  const onInitialRouteHandled = props.onInitialRouteHandled;
  useEffect(() => {
    onInitialRouteHandled?.();
    // 처음 한 번만 알린다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const onSubpageChange = props.onSubpageChange;
  // 게시물·다른 러너 프로필처럼 위에 쌓인 화면이나 대화방이 열리면 하단 바를 가리고 화면을 꽉 채운다
  const open = stack.length > 1;
  const fullScreen = open || chatDetail;
  useEffect(() => {
    onSubpageChange?.(fullScreen);
    return () => onSubpageChange?.(false);
  }, [fullScreen, onSubpageChange]);
  // 팔로우한 사람(과 내) 글 + 일부 추천 글
  const feed = useServerFeed('homeFeed');
  // 딥링크로 처음부터 열려 있는 화면은 밀려 들어오지 않고, 그 뒤에 쌓는 화면만 밀려 들어온다
  const initialDepth = useRef(stack.length);
  const push = (next: Route) => setStack(old => [...old, next]);
  const back = () => setStack(old => (old.length > 1 ? old.slice(0, -1) : old));
  const showPost = (id: string) => push({ page: 'post', id });
  const showProfile = (uid: string) => push({ page: 'profile', uid });
  const showComments = (id: string) => props.onComments(id, showProfile);
  const changed = () => {
    feed.refresh();
  };
  const selectSubNav = (key: SubNavKey) => {
    // 이미 보고 있는 피드를 다시 고르면 맨 위로 올리고 새로고침한다
    if (key === 'feed' && section === 'feed') {
      feedScroll.current?.scrollTo({ y: 0, animated: true });
      feed.refresh();
    }
    setSection(key);
  };
  const leaveSection = () => setSection('feed');
  // 피드 위에 쌓이는 하위 화면 하나. goBack은 밀려 나간 뒤 맨 위 화면을 없애는 함수다
  const renderPage = (route: Route, goBack: () => void): React.ReactNode => {
    if (route.page === 'chat')
      return (
        <ChatScreen
          initialPeer={route.peer}
          onBack={goBack}
          onProfile={showProfile}
        />
      );
    if (route.page === 'connections')
      return (
        <ConnectionsScreen
          uid={route.uid}
          initialKind={route.kind}
          onKindChange={kind =>
            setStack(old =>
              old.map((item, index) =>
                index === old.length - 1 && item.page === 'connections'
                  ? { ...item, kind }
                  : item,
              ),
            )
          }
          onBack={goBack}
          onProfile={showProfile}
          onMessage={uid => push({ page: 'chat', peer: uid })}
        />
      );
    if (route.page === 'compose')
      return (
        <Composer
          post={route.post}
          onBack={goBack}
          // 글은 서버가 저장을 끝낸 뒤에야 목록에 들어가므로, 끝나면 피드를 다시 불러온다
          onPosted={feed.refresh}
          onSaved={visibility => {
            // 전체 공개가 아닌 글은 피드에 보이지 않으니 내 프로필에서 확인할 수 있게 연다
            setStack([{ page: 'feed' }]);
            setSection(visibility === 'public' ? 'feed' : 'profile');
            feed.refresh();
          }}
        />
      );
    if (route.page === 'post')
      return (
        <PostDetail
          id={route.id}
          onComments={() => showComments(route.id)}
          onBack={goBack}
          onProfile={showProfile}
          onEdit={post => push({ page: 'compose', post })}
          onDeleted={() => {
            goBack();
            changed();
          }}
        />
      );
    if (route.page === 'profile')
      return (
        <ProfilePage
          key={route.uid}
          uid={route.uid}
          onBack={goBack}
          onPost={showPost}
          onTogether={props.onTogetherPress}
          onComments={showComments}
          onMessage={uid => push({ page: 'chat', peer: uid })}
          onConnections={kind =>
            push({ page: 'connections', uid: route.uid, kind })
          }
        />
      );
    if (route.page === 'search' || route.page === 'rankings')
      return (
        <PeoplePage
          ranking={route.page === 'rankings'}
          onBack={goBack}
          onProfile={showProfile}
        />
      );
    if (route.page === 'saved')
      return (
        <SavedPage
          onBack={goBack}
          onPost={showPost}
          onProfile={showProfile}
          onComments={showComments}
        />
      );
    return null;
  };
  const sectionPage = (): React.ReactNode => {
    if (section === 'explore')
      return (
        <ExplorePage
          bottomInset={sectionReserve}
          onBack={leaveSection}
          onSearch={() => push({ page: 'search' })}
          onOpen={showPost}
          onComments={showComments}
          onProfile={showProfile}
        />
      );
    if (section === 'messages')
      return (
        <ChatScreen
          onBack={leaveSection}
          onProfile={showProfile}
          onTogether={
            props.onTogetherPress && (() => props.onTogetherPress?.())
          }
          onDetailChange={setChatDetail}
          bottomInset={sectionReserve}
        />
      );
    if (section === 'profile')
      return (
        <ProfilePage
          key="me"
          uid={myUid()}
          bottomInset={sectionReserve}
          onBack={leaveSection}
          onPost={showPost}
          onTogether={props.onTogetherPress}
          onComments={showComments}
          onMessage={uid => push({ page: 'chat', peer: uid })}
          onConnections={kind =>
            push({ page: 'connections', uid: myUid(), kind })
          }
        />
      );
    return null;
  };
  const feedPage = (
    <Page title="커뮤니티" feed>
      <View style={styles.feedHeader}>
        <ScreenHeader
          title="커뮤니티"
          hasUnread={props.hasUnread}
          onNotificationPress={props.onNotificationPress}
          onSettingsPress={props.onSettingsPress}
        />
      </View>
      <View style={styles.feedSheet}>
        <ScrollView
          ref={feedScroll}
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
              accessibilityLabel="러너 랭킹"
              onPress={() => push({ page: 'rankings' })}
              style={styles.discovery}
            >
              <Trophy size={15} color={colors.textMuted} />
              <AppText variant="label">러너 랭킹</AppText>
            </Pressable>
          </View>
          {feed.status === 'loading' ? (
            <Loading />
          ) : feed.status === 'error' ? (
            <Failure retry={feed.refresh} />
          ) : feed.posts.length === 0 ? (
            <Empty
              title="아직 게시물이 없어요"
              detail="러너를 팔로우하거나, 오늘의 달리기를 기록과 함께 나눠 보세요."
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
      </View>
    </Page>
  );
  const subNavBottom = tabBarBottom(insets.bottom) + TAB_BAR_BODY_HEIGHT + 10;
  const sectionReserve = subNavBottom + ROW_HEIGHT + 8;
  const chrome = !fullScreen;
  return (
    <View style={styles.stackRoot}>
      <View
        style={styles.stackRoot}
        accessibilityElementsHidden={open || section !== 'feed'}
        importantForAccessibility={
          open || section !== 'feed' ? 'no-hide-descendants' : 'auto'
        }
      >
        {feedPage}
      </View>
      {section !== 'feed' && (
        <View
          style={styles.sectionLayer}
          accessibilityElementsHidden={open}
          importantForAccessibility={open ? 'no-hide-descendants' : 'auto'}
        >
          {sectionPage()}
        </View>
      )}
      {chrome && (section === 'feed' || section === 'explore') && (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.writeFab,
            { bottom: subNavBottom + (ROW_HEIGHT - WRITE_SIZE) / 2 },
            { transform: [{ translateY: writeLift }] },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="글쓰기"
            onPress={() => push({ page: 'compose' })}
            style={styles.writeButton}
          >
            <Pencil size={22} color={colors.textOnPrimary} />
          </Pressable>
        </Animated.View>
      )}
      {chrome && (
        <CommunitySubNav
          bottom={subNavBottom}
          unreadMessages={unreadChat}
          current={section}
          onSelect={selectSubNav}
          progress={subNavProgress}
        />
      )}
      {stack.slice(1).map((page, offset) => (
        <SlideScreen
          key={`${offset + 1}:${routeKey(page)}`}
          animateIn={offset + 1 >= initialDepth.current}
          onBack={back}
        >
          {goBack => renderPage(page, goBack)}
        </SlideScreen>
      ))}
    </View>
  );
}

// 쌓인 화면을 구분하는 키. 같은 자리에 다른 화면이 오면 새로 밀려 들어온다
function routeKey(route: Route) {
  return route.page === 'post'
    ? `post:${route.id}`
    : route.page === 'profile' || route.page === 'connections'
    ? `${route.page}:${route.uid}`
    : route.page === 'compose'
    ? `compose:${route.post?.post_id ?? 'new'}`
    : route.page === 'chat'
    ? `chat:${route.peer ?? ''}`
    : route.page;
}

function Page({
  title,
  headerText,
  headerRight,
  onBack,
  children,
  feed = false,
}: {
  feed?: boolean;
  title: string;
  // 머리글에 title 대신 보여 줄 글. 뒤로가기 버튼의 읽기 이름은 title을 그대로 쓴다
  headerText?: string;
  headerRight?: React.ReactNode;
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
          <AppText variant="heading" numberOfLines={1} style={styles.grow}>
            {headerText ?? title}
          </AppText>
          {headerRight}
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
  const author = usePostAuthor(post.uid, post);
  const authorName = author?.display_name ?? post.author_name;
  const authorImage = author ? author.profile_image : post.author_image;
  // 요청이 끝나기 전에 연타해도 서버에 엇갈린 값이 가지 않도록 종류별로 하나만 보낸다
  const inFlight = useRef({ like: false, bookmark: false });
  useEffect(
    () =>
      watchPostFlags(post.post_id, patch =>
        setFlags(old => ({ ...old, ...patch })),
      ),
    [post.post_id],
  );
  const toggle = (kind: 'like' | 'bookmark') => {
    if (inFlight.current[kind]) return;
    const key = kind === 'like' ? 'liked' : 'saved';
    const active = !flags[key];
    inFlight.current[kind] = true;
    // 서버 응답을 기다리지 않고 바로 반영하고, 실패하면 되돌린다
    setFlags(old => ({ ...old, [key]: active }));
    runInBackground({
      label: '',
      failureLabel:
        kind === 'like'
          ? '응원을 처리하지 못했어요'
          : '저장을 처리하지 못했어요',
      silent: true,
      retryable: false,
      describeError: socialError,
      task: () => socialRequest(kind, { postId: post.post_id, active }),
      onSuccess: () => {
        inFlight.current[kind] = false;
      },
      onFailure: () => {
        inFlight.current[kind] = false;
        setFlags(old => ({ ...old, [key]: !active }));
      },
    });
  };
  const remove = () =>
    Alert.alert('게시물을 삭제할까요?', '삭제한 게시물은 피드에서 사라져요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => {
          // 서버 처리를 기다리지 않고 바로 목록으로 돌아간다. 피드는 실시간으로 갱신된다
          runInBackground({
            label: '게시물 삭제 중',
            successLabel: '게시물을 삭제했어요',
            failureLabel: '게시물을 삭제하지 못했어요',
            describeError: socialError,
            task: () => socialRequest('deletePost', { postId: post.post_id }),
          });
          onDeleted?.();
        },
      },
    ]);
  const own = post.uid === myUid();
  const sharePost = () =>
    Share.share({
      message: `달료 · ${authorName}\n${post.text}${
        post.run_id ? `\n${post.distance_km?.toFixed(2)}km` : ''
      }`,
    }).catch(errorAlert);
  const menu = () =>
    Alert.alert('게시물', authorName, [
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
          accessibilityLabel={`${authorName} 프로필`}
          onPress={onProfile}
          style={styles.author}
        >
          <Avatar uri={authorImage} size={36} />
          <View style={styles.grow}>
            <AppText variant="subheading" numberOfLines={1}>
              {authorName}
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
          <FullPhoto uri={post.image_url} />
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
          accessibilityState={{ selected: flags.liked }}
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
          accessibilityState={{ selected: flags.saved }}
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
              <AppText variant="subheading">{authorName} </AppText>
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

export function Composer({
  post,
  onBack,
  onSaved,
  onPosted,
}: {
  post?: SocialPost;
  onBack: () => void;
  // 서버에 저장이 끝났을 때(백그라운드). 화면은 onSaved에서 이미 떠난 뒤일 수 있다
  onPosted?: () => void;
  onSaved: (visibility: SocialPost['visibility']) => void;
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
  const [error, setError] = useState<string | null>(null);
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
    try {
      const selected = await choosePhoto(camera);
      if (selected) setPhoto(selected);
    } catch (failure) {
      setError(socialError(failure));
    }
  };
  const submit = () => {
    if (!body.trim() && !photo && !runId && !post?.image_url) {
      setError('내용이나 사진, 달리기 기록을 추가해 주세요.');
      return;
    }
    setError(null);
    const text = body.trim();
    // 사진 업로드와 저장은 서버가 하는 일이라 기다리지 않고 피드로 돌아간다. 진행과 실패는 작은 팝업으로 알린다
    runInBackground({
      label: post ? '게시물 수정 중' : '게시물 올리는 중',
      successLabel: post ? '게시물을 수정했어요' : '게시물을 올렸어요',
      failureLabel: post
        ? '게시물을 수정하지 못했어요'
        : '게시물을 올리지 못했어요',
      describeError: socialError,
      onSuccess: () => onPosted?.(),
      task: async report => {
        if (post) {
          await socialRequest('editPost', { postId, text, visibility });
          return;
        }
        const uploaded = photo
          ? await uploadPhoto(photo, 'posts', report)
          : null;
        await socialRequest('createPost', {
          postId,
          text,
          visibility,
          imageUrl: uploaded?.url ?? null,
          runId,
        });
      },
    });
    onSaved(visibility);
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
          style={styles.composer}
        />
        <AppText variant="label" color={colors.textSubtle} align="right">
          {body.length}/2000
        </AppText>
        {(photo?.uri || post?.image_url) && (
          <FullPhoto
            uri={photo?.uri ?? post!.image_url!}
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
                onPress={() => selectPhoto(false)}
                style={styles.grow}
              />
              <Button
                label="사진 촬영"
                size="md"
                variant="secondary"
                onPress={() => selectPhoto(true)}
                style={styles.grow}
              />
              {photo && (
                <IconButton
                  icon={X}
                  accessibilityLabel="첨부 사진 제거"
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
                  }}
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
                setVisibility(value);
              }}
            />
          ))}
        </View>
        {error && (
          <AppText color={colors.danger} accessibilityRole="alert">
            {error}
          </AppText>
        )}
        <Button label={post ? '수정 저장' : '게시물 올리기'} onPress={submit} />
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

// 탐색: 서버가 추천 순서로 골라 준 다른 러너들의 공개 글. 러너 검색은 오른쪽 위 버튼으로 연다
function ExplorePage({
  bottomInset,
  onBack,
  onSearch,
  onOpen,
  onComments,
  onProfile,
}: {
  bottomInset: number;
  onBack: () => void;
  onSearch: () => void;
  onOpen: (id: string) => void;
  onComments: (id: string) => void;
  onProfile: (uid: string) => void;
}) {
  const feed = useServerFeed('exploreFeed');
  return (
    <Page
      title="탐색"
      onBack={onBack}
      headerRight={
        <IconButton
          icon={Search}
          variant="plain"
          accessibilityLabel="러너 검색"
          onPress={onSearch}
        />
      }
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomInset + spacing.xl }}
        refreshControl={
          <RefreshControl
            refreshing={feed.status === 'loading'}
            onRefresh={feed.refresh}
            tintColor={colors.primary}
          />
        }
      >
        {feed.status === 'loading' ? (
          <Loading />
        ) : feed.status === 'error' ? (
          <Failure retry={feed.refresh} />
        ) : feed.posts.length === 0 ? (
          <Empty
            title="아직 둘러볼 글이 없어요"
            detail="새로운 러너들이 글을 올리면 여기에 모여요."
          />
        ) : (
          feed.posts.map(post => (
            <PostCard
              key={post.post_id}
              post={post}
              onComments={() => onComments(post.post_id)}
              onOpen={() => onOpen(post.post_id)}
              onProfile={() => onProfile(post.uid)}
            />
          ))
        )}
        {feed.moreError && (
          <AppText color={colors.danger}>
            글을 더 불러오지 못했어요. 다시 시도해 주세요.
          </AppText>
        )}
        {feed.more && (
          <Button
            label={feed.loadingMore ? '불러오는 중…' : '더 둘러보기'}
            variant="secondary"
            disabled={feed.loadingMore}
            onPress={feed.loadMore}
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
              accessibilityLabel="러너 검색"
              placeholder="닉네임 앞부분, 또는 @아이디로 검색"
              value={name}
              onChangeText={setName}
              maxLength={21}
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
            detail="닉네임이나 @아이디를 다시 확인해 주세요."
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
                  {person.user_id ? `@${person.user_id} · ` : ''}
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
function ProfileViewSwitch({
  value,
  onChange,
  label,
}: {
  value: 'list' | 'grid';
  onChange: (value: 'list' | 'grid') => void;
  label: string;
}) {
  return (
    <View style={styles.profileViewSwitch}>
      {(['list', 'grid'] as const).map(mode => {
        const Icon = mode === 'list' ? List : LayoutGrid;
        return (
          <Pressable
            key={mode}
            accessibilityRole="button"
            accessibilityLabel={`${label} ${
              mode === 'list' ? '목록' : '그리드'
            } 보기`}
            accessibilityState={{ selected: value === mode }}
            onPress={() => onChange(mode)}
            style={[
              styles.profileViewButton,
              value === mode && styles.profileViewSelected,
            ]}
          >
            <Icon
              size={19}
              color={value === mode ? colors.primaryInk : colors.textMuted}
            />
          </Pressable>
        );
      })}
    </View>
  );
}
export function ProfilePage({
  uid,
  bottomInset = 0,
  onBack,
  onPost,
  onTogether,
  onComments,
  onMessage,
  onConnections,
}: {
  uid: string;
  // 화면 아래에 떠 있는 바에 끝이 가려지지 않도록 비워 둘 높이
  bottomInset?: number;
  onBack: () => void;
  onPost: (id: string) => void;
  onTogether?: (friendUid: string) => void;
  onMessage: (uid: string) => void;
  onComments: (id: string) => void;
  onConnections?: (kind: ConnectionKind) => void;
}) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [runner, setRunner] = useState<RunnerProfile | null>(null);
  const [postView, setPostView] = useState<'list' | 'grid'>('list');
  const [following, setFollowing] = useState(false);
  const [friend, setFriend] = useState(false);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    'loading',
  );
  const followInFlight = useRef(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let live = true;
    setStatus('loading');
    Promise.all([
      socialRequest<RunnerProfile>('profile', {
        uid,
      }),
      socialRequest<{ posts: SocialPost[] }>('profilePosts', { uid }),
    ])
      .then(([data, feed]) => {
        if (live) {
          setProfile(data.profile);
          setRunner(data);
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
  const follow = () => {
    if (followInFlight.current) return;
    followInFlight.current = true;
    const next = !following;
    // 서버 응답을 기다리지 않고 버튼을 바로 바꾸고, 실패하면 되돌린다
    setFollowing(next);
    runInBackground({
      label: '',
      failureLabel: next ? '팔로우하지 못했어요' : '팔로우를 취소하지 못했어요',
      silent: true,
      retryable: false,
      describeError: socialError,
      task: () => socialRequest('follow', { uid, following: next }),
      onSuccess: () => {
        followInFlight.current = false;
        // 팔로워 수 등을 다시 불러온다
        setRevision(v => v + 1);
      },
      onFailure: () => {
        followInFlight.current = false;
        setFollowing(!next);
      },
    });
  };
  return (
    <Page
      title="러너 프로필"
      // 맨 위에는 아이디를 보여 준다. 아이디가 없는 기존 사용자는 닉네임을 보여 준다
      headerText={
        profile
          ? profile.user_id
            ? `@${profile.user_id}`
            : profile.display_name
          : ''
      }
      onBack={onBack}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          bottomInset ? { paddingBottom: bottomInset + spacing.xl } : null,
        ]}
      >
        {status === 'loading' ? (
          <Loading />
        ) : status === 'error' ? (
          <Failure retry={() => setRevision(v => v + 1)} />
        ) : (
          profile && (
            <>
              <Card style={styles.runnerHero}>
                <View style={styles.runnerIdentity}>
                  <Avatar uri={profile.profile_image} size={64} />
                  <View style={styles.runnerIdentityText}>
                    <AppText variant="label" color={colors.primaryInk}>
                      DALRYO RUNNER
                    </AppText>
                    <AppText variant="heading" numberOfLines={1}>
                      {profile.display_name}
                    </AppText>
                    <AppText variant="caption" color={colors.textMuted}>
                      {profile.region}에서 함께 달려요
                    </AppText>
                  </View>
                </View>
                <View style={styles.runnerCounts}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="팔로워 목록"
                    style={styles.runnerCount}
                    onPress={() => onConnections?.('followers')}
                  >
                    <AppText variant="subheading">
                      {profile.follower_count}
                    </AppText>
                    <AppText variant="caption">팔로워</AppText>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="팔로잉 목록"
                    style={styles.runnerCount}
                    onPress={() => onConnections?.('following')}
                  >
                    <AppText variant="subheading">
                      {profile.following_count}
                    </AppText>
                    <AppText variant="caption">팔로잉</AppText>
                  </Pressable>
                </View>
                <View style={styles.runnerActions}>
                  {uid !== myUid() && (
                    <Button
                      style={styles.runnerAction}
                      label={following ? '팔로잉' : '팔로우'}
                      size="md"
                      variant={following ? 'secondary' : 'primary'}
                      onPress={follow}
                    />
                  )}
                  {uid !== myUid() && (
                    <Button
                      style={styles.runnerAction}
                      icon={MessageSquare}
                      label="메시지 보내기"
                      size="md"
                      variant="secondary"
                      onPress={() => onMessage(uid)}
                    />
                  )}
                </View>
                {friend && onTogether && (
                  <Button
                    label="같이 달리기 요청"
                    size="md"
                    onPress={() => onTogether(uid)}
                  />
                )}
              </Card>
              {runner?.pet &&
                CHARACTER_TYPES.includes(runner.pet.character_type) &&
                CHARACTER_STAGE_ORDER.includes(runner.pet.stage) && (
                  <Card style={styles.runnerPet}>
                    <AppText variant="label" color={colors.primaryInk}>
                      RUNNING MATE
                    </AppText>
                    <AppText variant="heading">{runner.pet.pet_name}</AppText>
                    <AppText variant="caption" color={colors.primaryInk}>
                      {
                        ['알', '아기', '어린이', '러너'][
                          CHARACTER_STAGE_ORDER.indexOf(runner.pet.stage)
                        ]
                      }
                    </AppText>
                    <CharacterView
                      type={runner.pet.character_type}
                      stage={runner.pet.stage}
                      motion={runner.pet.is_frozen ? 'stone' : 'idle'}
                      size={190}
                    />
                    <AppText variant="caption" color={colors.textMuted}>
                      {runner.pet.is_frozen
                        ? '다음 달리기를 기다리는 중'
                        : '함께 달리며 자라고 있어요'}
                    </AppText>
                  </Card>
                )}
              <Card style={styles.runnerRecords}>
                <AppText variant="subheading">러닝 발자국</AppText>
                <View style={styles.runnerStats}>
                  <View>
                    <AppText variant="heading">
                      {profile.total_km.toFixed(1)} km
                    </AppText>
                    <AppText variant="caption">누적 거리</AppText>
                  </View>
                  <View>
                    <AppText variant="heading">
                      {runner?.run_count ?? '—'}
                    </AppText>
                    <AppText variant="caption">완료한 러닝</AppText>
                  </View>
                </View>
                <View testID="profile-runs-list">
                  {(runner?.recent_runs ?? []).map((run, index) => (
                    <View key={index} style={styles.runnerRecordRow}>
                      <AppText variant="caption" color={colors.textMuted}>
                        {run.day}
                      </AppText>
                      <AppText variant="caption">
                        {run.distance_km.toFixed(2)}km
                      </AppText>
                      <AppText variant="caption" color={colors.textMuted}>
                        {formatDuration(run.duration_sec)} ·{' '}
                        {run.avg_pace_sec ? formatPace(run.avg_pace_sec) : '—'}
                      </AppText>
                    </View>
                  ))}
                </View>
                {!runner?.recent_runs?.length && (
                  <AppText color={colors.textMuted}>
                    아직 완료한 러닝이 없어요.
                  </AppText>
                )}
              </Card>
              <View style={styles.profileSectionHeader}>
                <AppText variant="subheading">최근 게시물</AppText>
                <ProfileViewSwitch
                  label="게시물"
                  value={postView}
                  onChange={setPostView}
                />
              </View>
              {posts.length === 0 ? (
                <Empty
                  title="공개된 글이 없어요"
                  detail="볼 수 있는 최근 게시물이 없습니다."
                />
              ) : postView === 'grid' ? (
                <View testID="profile-posts-grid" style={styles.profileGrid}>
                  {posts.map(post => (
                    <Pressable
                      key={post.post_id}
                      onPress={() => onPost(post.post_id)}
                      accessibilityRole="button"
                      accessibilityLabel={`${
                        post.text || '러닝 기록'
                      } 게시물 열기`}
                      style={styles.profilePostTile}
                    >
                      {post.image_url ? (
                        <Image
                          source={{ uri: post.image_url }}
                          style={styles.profilePostImage}
                        />
                      ) : (
                        <View style={styles.profilePostPlaceholder}>
                          <Footprints size={28} color={colors.primaryInk} />
                          {post.distance_km != null && (
                            <AppText variant="subheading">
                              {post.distance_km.toFixed(2)} km
                            </AppText>
                          )}
                        </View>
                      )}
                      <View style={styles.profilePostCaption}>
                        <AppText variant="caption" numberOfLines={2}>
                          {post.text || '오늘의 러닝'}
                        </AppText>
                        <AppText variant="label" color={colors.textMuted}>
                          {new Date(post.createdAtMs).toLocaleDateString(
                            'ko-KR',
                          )}
                        </AppText>
                      </View>
                    </Pressable>
                  ))}
                </View>
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
  runnerHero: { gap: 16 },
  runnerIdentity: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  runnerIdentityText: { flex: 1, gap: 4 },
  runnerCounts: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
  },
  runnerCount: {
    alignItems: 'center',
    gap: 4,
    minWidth: 100,
    minHeight: 48,
    justifyContent: 'center',
  },
  runnerActions: { flexDirection: 'row', gap: 10 },
  runnerAction: { flex: 1 },
  runnerPet: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    gap: 8,
  },
  runnerRecords: { gap: 14 },
  profileSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  profileViewSwitch: {
    flexDirection: 'row',
    gap: 2,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    padding: 2,
  },
  profileViewButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  profileViewSelected: { backgroundColor: colors.primarySoft },
  profileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  profilePostTile: {
    width: '48%',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  profilePostImage: { width: '100%', aspectRatio: 1 },
  profilePostPlaceholder: {
    width: '100%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primarySoft,
  },
  profilePostCaption: { padding: 10, gap: 6 },
  runnerStats: { flexDirection: 'row', justifyContent: 'space-between' },
  runnerRecordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  content: { padding: spacing.xl, paddingBottom: 60, gap: spacing.md },
  feedCanvas: { backgroundColor: colors.background },
  // 하단 탭 바와 그 위의 서브 네비게이션에 마지막 글이 가려지지 않게 비워 둔다
  feedContent: { paddingBottom: TAB_BAR_HEIGHT + 100 },
  // 오른쪽 아래에 떠 있는 원형 글쓰기 버튼. 서브 네비게이션이 펼쳐지면 위로 비켜 준다
  writeFab: { position: 'absolute', right: spacing.xl },
  writeButton: {
    width: WRITE_SIZE,
    height: WRITE_SIZE,
    borderRadius: WRITE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    shadowColor: '#101814',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
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
  stackRoot: { flex: 1 },
  sectionLayer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.background,
  },
  feedScreen: { backgroundColor: colors.sky },
  feedHeader: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  // 하늘색 배경 위로 둥근 윗모서리를 드러내며 올라오는 피드 영역
  feedSheet: {
    flex: 1,
    overflow: 'hidden',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: colors.background,
  },
  // 피드 배경과 같은 색(배경을 칠하지 않는다). 버튼은 흰색으로 두어 배경 위에서 또렷하게 보이게 한다
  discoveryRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
    marginBottom: 6,
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
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
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
