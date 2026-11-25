import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  Image,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Switch,
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
  Ban,
  ChevronLeft,
  Settings as SettingsIcon,
  EyeOff,
  Flag,
  Footprints as FootprintsIcon,
  ImagePlus,
  MapPin,
  MessageCircle,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Share2,
  Trash2,
  Trophy,
  UserPlus,
  UserRound,
  Users,
  X,
  LayoutGrid,
  List,
} from 'lucide-react-native';
import {
  ActionSheet,
  type ActionSheetItem,
  AppText,
  Button,
  Card,
  Chip,
  FullPhoto,
  IconButton,
  PhotoSourceSheet,
  ScreenHeader,
  SectionHeader,
} from '../../components/ui';
import { SCREEN_HEADER_HEIGHT } from '../../components/ui/ScreenHeader';
import { RunningShoeIcon } from '../../components/ui/RunningShoeIcon';
import { SlideScreen } from '../../navigation/slide';
import { ChatScreen } from './ChatScreen';
import { CommentsSheet } from './CommentsSheet';
import { RunnerStatsCard } from './RunnerStatsCard';
import { RunPickerSheet, runDay, runTime } from './RunPickerSheet';
import { RunnerTagSheet } from './RunnerTagSheet';
import { ReportSheet, sendReport } from './ReportSheet';
import { ConnectionsScreen, type ConnectionKind } from './ConnectionsScreen';
import { CommunitySubNav, ROW_HEIGHT, type SubNavKey } from './CommunitySubNav';
import { hasUnread, watchConversations } from '../../services/chat.service';
import {
  TAB_BAR_BODY_HEIGHT,
  tabBarBottom,
} from '../../navigation/BottomTabBar';
import {
  colors,
  fonts,
  radius,
  spacing,
  themedStyles,
  statusBarStyle,
  typography,
  switchColors,
} from '../../theme';
import { useHiddenContent } from '../../hooks/useHiddenContent';
import { useServerFeed } from '../../hooks/useServerFeed';
import { usePostAuthor } from '../../hooks/usePostAuthor';
import { choosePhoto, uploadPhoto } from '../../services/media.service';
import { runInBackground } from '../../services/backgroundTask.service';
import { fetchRunDistrict } from '../../services/runLocation.service';
import {
  buildPostText,
  MAX_CONTENT_LENGTH,
  MAX_TAG_INPUT_LENGTH,
} from '../../utils/shareCard';
import { isDetailedRegion } from '../../utils/regions';
import {
  myRegion,
  myUid,
  newSocialId,
  savedPosts,
  socialError,
  socialRequest,
  watchPost,
  watchPostFlags,
  type Friend,
  type PublicProfile,
  type SocialPost,
  type RunSummary,
  type RunnerProfile,
} from '../../services/social.service';
import { formatDuration, formatPace } from '../../utils/pace';
import type { Asset } from 'react-native-image-picker';
import type { RunDocument } from '../../types/run.types';

type Props = {
  hasUnread?: boolean;
  onNotificationPress: () => void;
  onSettingsPress: () => void;
  // 내 프로필 메뉴의 "프로필 설정". 설정을 프로필 항목으로 바로 연다
  onProfileSettingsPress?: () => void;
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
  | { page: 'chat'; roomId: string }
  // 설정의 "저장한 게시물"에서 넘어올 때
  | { page: 'saved' };
type Route =
  | { page: 'feed' }
  | { page: 'compose'; post?: SocialPost }
  | { page: 'post'; id: string }
  | { page: 'profile'; uid: string }
  | { page: 'connections'; uid: string; kind: ConnectionKind }
  | { page: 'runs'; uid: string }
  | { page: 'search' }
  | { page: 'rankings' }
  | { page: 'saved' }
  | { page: 'chat'; peer?: string; roomId?: string };
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
  const hidden = useHiddenContent();
  return (
    <>
      <CommunityContent
        {...props}
        hidden={hidden}
        onComments={(id, onProfile) => setComments({ id, onProfile })}
      />
      {comments && (
        <CommentsSheet
          key={comments.id}
          postId={comments.id}
          onClose={() => setComments(null)}
          onProfile={comments.onProfile}
          hiddenUids={hidden.blockedUids}
        />
      )}
    </>
  );
}

function CommunityContent(
  props: Props & {
    hidden: ReturnType<typeof useHiddenContent>;
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
  // 서브 네비게이션의 펼침 정도(서브 네비게이션이 쓴다)
  const subNavProgress = useRef(new Animated.Value(0)).current;
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
  // 글쓰기는 피드·탐색·내 프로필 머리글의 + 버튼으로 연다
  const writePost = () => push({ page: 'compose' });
  const changed = () => {
    feed.refresh();
  };
  const editPost = (post: SocialPost) => push({ page: 'compose', post });
  // 차단하거나 보지 않기로 한 글은 이미 불러온 목록에서도 바로 뺀다
  const { blockedUids, hiddenPostIds } = props.hidden;
  const wanted = (post: SocialPost) =>
    !blockedUids.has(post.uid) && !hiddenPostIds.has(post.post_id);
  const feedPosts = feed.posts.filter(wanted);
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
          initialRoomId={route.roomId}
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
            setStack([{ page: 'feed' }]);
            // 새 글이 전체 공개가 아니면 피드에 보이지 않으니 내 프로필에서 확인할 수 있게 연다.
            // 고친 글은 보던 화면으로 그대로 돌아간다
            if (!route.post)
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
          onEdit={editPost}
          onSettings={props.onProfileSettingsPress}
          onRuns={() => push({ page: 'runs', uid: route.uid })}
          onTogether={props.onTogetherPress}
          onComments={showComments}
          onMessage={uid => push({ page: 'chat', peer: uid })}
          onConnections={kind =>
            push({ page: 'connections', uid: route.uid, kind })
          }
          onProfile={showProfile}
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
    if (route.page === 'runs')
      return <RunsPage uid={route.uid} onBack={goBack} />;
    if (route.page === 'saved')
      return (
        <SavedPage
          wanted={wanted}
          onBack={goBack}
          onEdit={editPost}
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
          wanted={wanted}
          bottomInset={sectionReserve}
          onBack={leaveSection}
          onSearch={() => push({ page: 'search' })}
          onWrite={writePost}
          onOpen={showPost}
          onComments={showComments}
          onProfile={showProfile}
        />
      );
    if (section === 'messages')
      return (
        <ChatScreen
          hideBack
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
          hideBack
          onWrite={writePost}
          bottomInset={sectionReserve}
          onBack={leaveSection}
          onPost={showPost}
          onEdit={editPost}
          onSettings={props.onProfileSettingsPress}
          onRuns={() => push({ page: 'runs', uid: myUid() })}
          onTogether={props.onTogetherPress}
          onComments={showComments}
          onMessage={uid => push({ page: 'chat', peer: uid })}
          onConnections={kind =>
            push({ page: 'connections', uid: myUid(), kind })
          }
          onProfile={showProfile}
        />
      );
    return null;
  };
  const subNavBottom = tabBarBottom(insets.bottom) + TAB_BAR_BODY_HEIGHT + 10;
  const sectionReserve = subNavBottom + ROW_HEIGHT + 8;
  const feedPage = (
    <Page title="커뮤니티">
      <FeedScroll
        id="community-feed"
        scrollRef={feedScroll}
        bottomInset={sectionReserve + spacing.md}
        refreshing={feed.status === 'loading'}
        onRefresh={feed.refresh}
        header={
          <ScreenHeader
            title="커뮤니티"
            hasUnread={props.hasUnread}
            onNotificationPress={props.onNotificationPress}
            onSettingsPress={props.onSettingsPress}
            onCreatePress={writePost}
          />
        }
      >
        <View style={styles.discoveryRow}>
          {/* 옅은 색 버튼. 같이 달리기는 브랜드 파랑, 러너 랭킹은 트로피에 맞춘 골드. 두 버튼은 폭을 반씩 나눈다 */}
          {props.onTogetherPress && (
            <Button
              label="같이 달리기"
              accessibilityLabel="같이 달리기"
              icon={Users}
              size="md"
              variant="soft"
              style={styles.discovery}
              onPress={() => props.onTogetherPress?.()}
            />
          )}
          <Button
            label="러너 랭킹"
            accessibilityLabel="러너 랭킹"
            icon={Trophy}
            size="md"
            variant="soft"
            tone="accent"
            style={styles.discovery}
            onPress={() => push({ page: 'rankings' })}
          />
        </View>
        {feed.status === 'loading' ? (
          <Loading />
        ) : feed.status === 'error' ? (
          <Failure retry={feed.refresh} />
        ) : feedPosts.length === 0 ? (
          <Empty
            title="아직 게시물이 없어요"
            detail="러너를 팔로우하거나, 오늘의 달리기를 기록과 함께 나눠 보세요."
            action={{ label: '글쓰기', onPress: writePost }}
          />
        ) : (
          feedPosts.map(post => (
            <PostCard
              key={post.post_id}
              post={post}
              onComments={() => showComments(post.post_id)}
              onOpen={() => showPost(post.post_id)}
              onProfile={showProfile}
              onEdit={() => editPost(post)}
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
      </FeedScroll>
    </Page>
  );
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
    : route.page === 'profile' ||
      route.page === 'connections' ||
      route.page === 'runs'
    ? `${route.page}:${route.uid}`
    : route.page === 'compose'
    ? `compose:${route.post?.post_id ?? 'new'}`
    : route.page === 'chat'
    ? `chat:${route.peer ?? ''}`
    : route.page;
}

function FeedScroll({
  id,
  scrollRef,
  bottomInset,
  refreshing,
  onRefresh,
  header,
  children,
}: {
  id: string;
  scrollRef?: React.Ref<ScrollView>;
  bottomInset: number;
  refreshing: boolean;
  onRefresh: () => void;
  header: React.ReactNode;
  children: React.ReactNode;
}) {
  const headerAnchor = useRef(0);
  const headerHidden = useRef(false);
  const [hiddenHeader, setHiddenHeader] = useState(false);
  const headerOffset = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.timing(headerOffset, {
      toValue: hiddenHeader ? -SCREEN_HEADER_HEIGHT : 0,
      duration: 160,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [headerOffset, hiddenHeader]);
  const updateFeedHeader = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const limit = Math.max(0, contentSize.height - layoutMeasurement.height);
    const y = Math.max(0, Math.min(contentOffset.y, limit));
    let hidden = headerHidden.current;
    // 끝에서 튕기는 이동과 작은 스크롤 떨림은 방향 전환으로 보지 않는다.
    if (y <= 2) {
      hidden = false;
      headerAnchor.current = 0;
    } else if (hidden) {
      headerAnchor.current = Math.max(headerAnchor.current, y);
      if (headerAnchor.current - y >= 10) hidden = false;
    } else {
      headerAnchor.current = Math.min(headerAnchor.current, y);
      if (y >= SCREEN_HEADER_HEIGHT && y - headerAnchor.current >= 10)
        hidden = true;
    }
    if (hidden !== headerHidden.current) {
      headerAnchor.current = y;
      headerHidden.current = hidden;
      setHiddenHeader(hidden);
    }
  };
  return (
    <View style={styles.feedSheet}>
      <ScrollView
        testID={id}
        ref={scrollRef}
        style={styles.feedCanvas}
        showsVerticalScrollIndicator={false}
        onScroll={updateFeedHeader}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingTop: SCREEN_HEADER_HEIGHT,
          paddingBottom: bottomInset,
        }}
        refreshControl={
          <RefreshControl
            progressViewOffset={SCREEN_HEADER_HEIGHT}
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            // Android 당겨서 새로고침 동그라미. 다크 모드에서도 흰 원이 튀지 않게 띄운 면 색을 쓴다
            colors={[colors.primary]}
            progressBackgroundColor={colors.surfaceRaised}
          />
        }
      >
        {children}
      </ScrollView>
      <Animated.View
        testID={`${id}-header`}
        pointerEvents={hiddenHeader ? 'none' : 'auto'}
        accessibilityElementsHidden={hiddenHeader}
        importantForAccessibility={
          hiddenHeader ? 'no-hide-descendants' : 'auto'
        }
        style={[
          styles.feedHeader,
          { transform: [{ translateY: headerOffset }] },
        ]}
      >
        {header}
      </Animated.View>
    </View>
  );
}

function Page({
  title,
  headerText,
  headerRight,
  onBack,
  hideBack = false,
  testID,
  children,
  hideHeader = false,
}: {
  hideHeader?: boolean;
  title: string;
  // 머리글에 title 대신 보여 줄 글. 뒤로가기 버튼의 읽기 이름은 title을 그대로 쓴다
  headerText?: string;
  headerRight?: React.ReactNode;
  onBack?: () => void;
  // 서브 네비게이션으로 오가는 화면처럼 뒤로 가기 버튼이 필요 없는 화면. 시스템 뒤로 가기는 그대로 동작한다
  hideBack?: boolean;
  testID?: string;
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
    <SafeAreaView testID={testID} style={styles.screen} edges={['top']}>
      <StatusBar barStyle={statusBarStyle()} />
      {onBack && !hideHeader && (
        <View style={[styles.header, hideBack && styles.headerNoBack]}>
          {!hideBack && (
            <IconButton
              icon={ChevronLeft}
              variant="plain"
              accessibilityLabel={`${title}에서 뒤로`}
              onPress={onBack}
            />
          )}
          <AppText
            variant="heading"
            accessibilityRole="header"
            accessibilityLabel={headerText || title}
            numberOfLines={1}
            style={styles.grow}
          >
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
function Loading() {
  return <ActivityIndicator style={styles.loading} color={colors.primary} />;
}
// 빈 화면. action이 있으면 바로 할 수 있는 일을 버튼으로 둔다
function Empty({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <Card style={styles.empty}>
      <AppText variant="subheading">{title}</AppText>
      <AppText color={colors.textMuted} align="center">
        {detail}
      </AppText>
      {action && (
        <Button
          label={action.label}
          variant="secondary"
          size="md"
          onPress={action.onPress}
        />
      )}
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
  post: initialPost,
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
  // 글쓴이나 함께 달린 사람의 프로필을 연다
  onProfile: (uid: string) => void;
  onEdit?: () => void;
  // 삭제·보지 않음·차단으로 이 글이 사라졌을 때
  onDeleted?: () => void;
  detail?: boolean;
  // 이미 좌우 여백이 있는 화면에 놓일 때. 카드 자체의 좌우 여백을 뺀다
}) {
  const [post, setPost] = useState(initialPost);
  // 삭제됐거나 보지 않기로 해서 더 보여 주지 않는 글
  const [gone, setGone] = useState(false);
  // null은 메뉴를 연 적이 없다는 뜻이다. 그때까지는 시트를 만들지 않는다
  const [menuOpen, setMenuOpen] = useState<boolean | null>(null);
  // 신고 시트
  const [reportOpen, setReportOpen] = useState(false);
  useEffect(() => setPost(initialPost), [initialPost]);
  // 피드는 요청해서 받는 목록이라, 응원·댓글 수와 수정·삭제는 글마다 직접 지켜본다.
  // 상세 화면은 부모가 이미 지켜보고 있다
  useEffect(() => {
    if (detail) return undefined;
    return watchPost(
      initialPost.post_id,
      next => {
        if (next) setPost(next);
        else setGone(true);
      },
      () => {},
    );
  }, [initialPost.post_id, detail]);
  const [flags, setFlags] = useState({ liked: false, saved: false });
  // 응원을 누르면 서버 숫자가 오기 전에 아이콘 옆 숫자부터 바꾼다. 서버 숫자가 바뀌면 그 값을 따른다
  const [likeDelta, setLikeDelta] = useState(0);
  useEffect(() => setLikeDelta(0), [post.like_count]);
  const likeCount = Math.max(0, post.like_count + likeDelta);
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
    const step = kind === 'like' ? (active ? 1 : -1) : 0;
    setLikeDelta(old => old + step);
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
        setLikeDelta(old => old - step);
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
          // 서버 처리를 기다리지 않고 바로 목록으로 돌아간다. 처리가 끝나면 카드가 스스로 사라진다
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
    })
      .then(result => {
        // 공유 창을 닫기만 했을 때는 세지 않는다. 숫자는 서버가 올린 뒤 글을 지켜보는 쪽에서 바뀐다
        if (result.action !== Share.sharedAction) return;
        runInBackground({
          label: '',
          failureLabel: '공유 수를 반영하지 못했어요',
          silent: true,
          retryable: false,
          describeError: socialError,
          task: () => socialRequest('share', { postId: post.post_id }),
        });
      })
      .catch(errorAlert);
  const hide = () => {
    setGone(true);
    onDeleted?.();
    runInBackground({
      label: '게시물 숨기는 중',
      successLabel: '이 게시물을 더 이상 보여 주지 않아요',
      failureLabel: '게시물을 숨기지 못했어요',
      retryable: false,
      describeError: socialError,
      task: () => socialRequest('hidePost', { postId: post.post_id }),
      onFailure: () => setGone(false),
    });
  };
  const block = () =>
    Alert.alert(
      `${authorName}님을 차단할까요?`,
      '서로의 팔로우가 끊기고, 이 러너의 글과 댓글이 보이지 않아요. 차단은 설정에서 해제할 수 있어요.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '차단',
          style: 'destructive',
          onPress: () => {
            setGone(true);
            onDeleted?.();
            runInBackground({
              label: '차단하는 중',
              successLabel: `${authorName}님을 차단했어요`,
              failureLabel: '차단하지 못했어요',
              retryable: false,
              describeError: socialError,
              task: () =>
                socialRequest('blockUser', { uid: post.uid, blocked: true }),
              onFailure: () => setGone(false),
            });
          },
        },
      ],
    );
  const menuItems: ActionSheetItem[] = own
    ? [
        ...(onEdit
          ? [
              {
                label: '수정',
                accessibilityLabel: '게시물 수정',
                icon: Pencil,
                onPress: onEdit,
              },
            ]
          : []),
        {
          label: '삭제',
          accessibilityLabel: '게시물 삭제',
          icon: Trash2,
          danger: true,
          onPress: remove,
        },
      ]
    : [
        { label: '이 게시물 보지 않음', icon: EyeOff, onPress: hide },
        {
          label: '신고',
          accessibilityLabel: '게시물 신고',
          icon: Flag,
          onPress: () => setReportOpen(true),
        },
        {
          label: `${authorName} 차단`,
          icon: Ban,
          danger: true,
          onPress: block,
        },
      ];
  if (gone) return null;
  const postedDate = post.createdAtMs
    ? new Date(post.createdAtMs).toLocaleDateString('ko-KR', {
        month: 'long',
        day: 'numeric',
      })
    : '';
  const postMeta = [
    postedDate,
    own || post.visibility !== 'public' ? VISIBILITY[post.visibility] : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const hasMedia = !!post.image_url || !!post.run_id;
  // 사진·기록 아래에 붙는 본문. 글만 있는 예전 글은 본문이 위쪽 큰 칸에 나온다
  const hasCaption = hasMedia && !!post.text;
  const withRunners = post.with_runners ?? [];
  return (
    <View
      testID={`community-post-${post.post_id}`}
      style={[styles.post, detail && styles.detailPost]}
    >
      <View style={styles.postHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${authorName} 프로필`}
          onPress={() => onProfile(post.uid)}
          style={styles.author}
        >
          <Avatar uri={authorImage} size={36} />
          <View style={styles.grow}>
            <AppText
              variant="subheading"
              style={styles.postAuthorName}
              numberOfLines={1}
            >
              {authorName}
            </AppText>
            {!!postMeta && (
              <AppText
                variant="caption"
                style={styles.postMeta}
                color={colors.textMuted}
                numberOfLines={1}
              >
                {postMeta}
              </AppText>
            )}
          </View>
        </Pressable>
        <IconButton
          icon={MoreHorizontal}
          variant="plain"
          accessibilityLabel="게시물 메뉴"
          onPress={() => setMenuOpen(true)}
        />
        {menuOpen !== null && (
          <ActionSheet
            visible={menuOpen}
            onClose={() => setMenuOpen(false)}
            items={menuItems}
          />
        )}
        {reportOpen && (
          <ReportSheet
            target={{ type: 'post', id: post.post_id }}
            note="신고한 게시물은 더 이상 보이지 않아요."
            onClose={() => setReportOpen(false)}
            onSubmit={(reason, detailText) => {
              // 신고와 함께 내 피드에서 숨긴다
              setGone(true);
              onDeleted?.();
              sendReport(
                { type: 'post', id: post.post_id },
                reason,
                detailText,
                {
                  successLabel: '신고했어요. 이 게시물은 더 이상 보이지 않아요',
                  also: () =>
                    socialRequest('hidePost', { postId: post.post_id }),
                },
              );
            }}
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
              <AppText variant="label" color={colors.textMuted}>
                공유한 러닝 기록
              </AppText>
            </View>
            <View style={styles.runTileDistance}>
              <AppText
                style={styles.runTileNumber}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {(post.distance_km ?? 0).toFixed(2)}
              </AppText>
              <AppText variant="heading" color={colors.primaryInk}>
                km
              </AppText>
            </View>
            <View style={styles.runTileStats}>
              {!!post.avg_pace_sec && (
                <AppText variant="subheading" color={colors.text}>
                  {formatPace(post.avg_pace_sec)} /km
                </AppText>
              )}
              {post.calories != null && (
                <AppText variant="caption" color={colors.textMuted}>
                  {post.calories} kcal
                </AppText>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.textPost}>
            <AppText
              style={styles.textPostBody}
              numberOfLines={detail ? undefined : 5}
              selectable={detail}
            >
              {post.text}
            </AppText>
          </View>
        )}
        {!!post.image_url && !!post.run_id && (
          <View style={styles.attachedRun}>
            <Footprints color={colors.primaryInk} size={16} />
            <AppText variant="caption" color={colors.primaryInk}>
              {(post.distance_km ?? 0).toFixed(2)} km
              {!!post.avg_pace_sec && ` · ${formatPace(post.avg_pace_sec)} /km`}
            </AppText>
          </View>
        )}
      </Pressable>
      {/* 응원·댓글·공유 수는 각 아이콘 오른쪽에 둔다. 0이면 숫자를 감춘다 */}
      <View style={styles.postActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="응원"
          accessibilityState={{ selected: flags.liked }}
          accessibilityValue={countValue(likeCount)}
          onPress={() => toggle('like')}
          style={styles.socialAction}
        >
          <RunningShoeIcon
            size={28}
            color={flags.liked ? colors.primary : colors.text}
            active={flags.liked}
          />
          <SocialCount testID="post-like-count" value={likeCount} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="댓글 보기"
          accessibilityValue={countValue(post.comment_count)}
          onPress={onComments}
          style={styles.socialAction}
        >
          <MessageCircle size={25} color={colors.text} strokeWidth={1.8} />
          <SocialCount testID="post-comment-count" value={post.comment_count} />
        </Pressable>
        {post.visibility === 'public' && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="게시물 공유"
            accessibilityValue={countValue(post.share_count ?? 0)}
            onPress={sharePost}
            style={styles.socialAction}
          >
            <Share2 size={24} color={colors.text} strokeWidth={1.8} />
            <SocialCount
              testID="post-share-count"
              value={post.share_count ?? 0}
            />
          </Pressable>
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
      {(hasCaption || withRunners.length > 0) && (
        <View style={styles.postCaption}>
          {hasCaption && (
            <Pressable
              testID="post-caption"
              accessibilityRole={detail ? undefined : 'button'}
              disabled={detail}
              onPress={onOpen}
            >
              {/* 본문 앞에 글쓴이 닉네임을 굵게 붙인다. 닉네임을 누르면 프로필로 간다 */}
              <AppText
                style={styles.captionText}
                numberOfLines={detail ? undefined : 3}
                selectable={detail}
              >
                <AppText
                  style={[styles.captionText, styles.captionAuthor]}
                  onPress={() => onProfile(post.uid)}
                >
                  {authorName}
                </AppText>
                {` ${post.text}`}
              </AppText>
            </Pressable>
          )}
          {withRunners.length > 0 && (
            <View testID="post-with-runners" style={styles.withRunners}>
              <Users size={15} color={colors.textMuted} />
              <AppText
                variant="caption"
                color={colors.textMuted}
                style={styles.grow}
              >
                {withRunners.map((runner, index) => (
                  <React.Fragment key={runner.uid}>
                    {index > 0 && ', '}
                    <AppText
                      variant="caption"
                      accessibilityRole="link"
                      accessibilityLabel={`${runner.display_name} 프로필`}
                      style={styles.withRunnerName}
                      onPress={() => onProfile(runner.uid)}
                    >
                      {runner.display_name}
                    </AppText>
                  </React.Fragment>
                ))}
                님과 함께 달렸어요
              </AppText>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// 아이콘 옆 숫자. 0이면 숫자 없이 아이콘만 남긴다
function SocialCount({ value, testID }: { value: number; testID: string }) {
  if (value <= 0) return null;
  return (
    <AppText testID={testID} variant="subheading" style={styles.socialCount}>
      {compactCount(value)}
    </AppText>
  );
}
// 1만이 넘으면 "1.2만"처럼 줄인다
export function compactCount(value: number) {
  if (value < 10_000) return value.toLocaleString('ko-KR');
  const man = Math.floor(value / 1_000) / 10;
  return `${man % 1 === 0 ? man.toFixed(0) : man.toFixed(1)}만`;
}
// 화면 읽기에서 아이콘 이름 뒤에 읽을 숫자
function countValue(value: number) {
  return value > 0 ? { text: `${value}개` } : undefined;
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
  // 새 글은 "내용"만, 고치는 글은 본문 전체(태그·위치 줄 포함)를 담는다
  const [body, setBody] = useState(post?.text ?? '');
  const [tags, setTags] = useState('');
  const [visibility, setVisibility] = useState<SocialPost['visibility']>(
    post?.visibility ?? 'public',
  );
  // 새 글에는 사진이나 달리기 기록 중 하나가 꼭 있어야 한다
  const [photo, setPhoto] = useState<Asset | null>(null);
  const [run, setRun] = useState<RunDocument | null>(null);
  const [withRunners, setWithRunners] = useState<Friend[]>([]);
  const [shareLocation, setShareLocation] = useState(false);
  const [location, setLocation] = useState<string | null>(null);
  const [locationLoading, setLocationLoading] = useState(!post);
  // 프로필 지역이 시·도뿐이라(예전 값) 위치로 쓰지 못할 때 안내한다
  const [regionTooBroad, setRegionTooBroad] = useState(false);
  const [sheet, setSheet] = useState<'photo' | 'run' | 'runners' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [postId] = useState(() => post?.post_id ?? newSocialId());
  // 공개할 위치: 첨부한 달리기의 출발 지점(광역시는 구·군, 도는 시·군). 알 수 없으면 프로필에 적어 둔 지역.
  // 프로필 지역이 "경기"처럼 시·도뿐이면 너무 넓어서 쓰지 않는다
  useEffect(() => {
    if (post) return undefined;
    let active = true;
    setLocationLoading(true);
    const resolve = async () => {
      const district = run ? await fetchRunDistrict(run) : null;
      if (district) return { label: district, tooBroad: false };
      const region = await myRegion().catch(() => null);
      return isDetailedRegion(region)
        ? { label: region, tooBroad: false }
        : { label: null, tooBroad: !!region };
    };
    resolve()
      .catch(() => ({ label: null, tooBroad: false }))
      .then(({ label, tooBroad }) => {
        if (!active) return;
        setLocation(label);
        setRegionTooBroad(tooBroad);
        setLocationLoading(false);
      });
    return () => {
      active = false;
    };
  }, [post, run]);
  const dirty = post
    ? body !== post.text || visibility !== post.visibility
    : !!body.trim() ||
      !!tags.trim() ||
      visibility !== 'public' ||
      !!photo ||
      !!run ||
      withRunners.length > 0 ||
      shareLocation;
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
  // 사진과 달리기 기록은 둘 중 하나만 붙인다
  const selectPhoto = async (camera: boolean) => {
    try {
      const selected = await choosePhoto(camera);
      if (selected) {
        setPhoto(selected);
        setRun(null);
        setError(null);
      }
    } catch (failure) {
      setError(socialError(failure));
    }
  };
  const pickRun = (picked: RunDocument) => {
    setRun(picked);
    setPhoto(null);
    setError(null);
  };
  const detach = () => {
    setPhoto(null);
    setRun(null);
  };
  const submit = () => {
    if (post) {
      if (!body.trim() && !post.image_url && !post.run_id) {
        setError('내용을 입력해 주세요.');
        return;
      }
    } else if (!photo && !run) {
      setError('사진이나 달리기 기록을 첨부해 주세요.');
      return;
    }
    setError(null);
    const text = post
      ? body.trim()
      : buildPostText({
          content: body,
          tags,
          location: shareLocation ? location : null,
        });
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
          runId: run?.run_id ?? null,
          withUids: withRunners.map(runner => runner.uid),
        });
      },
    });
    onSaved(visibility);
  };
  const visibilityChoices = (
    <View style={styles.choices} accessibilityRole="radiogroup">
      {(
        Object.entries(VISIBILITY) as Array<[SocialPost['visibility'], string]>
      ).map(([value, label]) => (
        <Chip
          key={value}
          label={label}
          selected={visibility === value}
          grow
          onPress={() => setVisibility(value)}
        />
      ))}
    </View>
  );
  if (post)
    return (
      <Page title="게시물 수정" onBack={leave}>
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
          {!!post.image_url && (
            <FullPhoto uri={post.image_url} style={styles.postImage} />
          )}
          <AppText variant="subheading">공개 범위</AppText>
          {visibilityChoices}
          {error && (
            <AppText color={colors.danger} accessibilityRole="alert">
              {error}
            </AppText>
          )}
          <Button label="수정 저장" onPress={submit} />
        </ScrollView>
      </Page>
    );
  const attached = !!photo || !!run;
  return (
    <Page title="오늘의 달리기" onBack={leave}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.composeContent}
      >
        {/* 1. 첨부: 사진이나 달리기 기록 중 하나를 꼭 고른다 */}
        <ComposeSection
          title="사진 또는 달리기 기록"
          hint={attached ? undefined : '둘 중 하나를 꼭 첨부해 주세요.'}
        >
          {photo ? (
            <>
              <FullPhoto uri={photo.uri!} style={styles.attachedPhoto} />
              <AttachmentActions
                changeLabel="다른 사진"
                onChange={() => setSheet('photo')}
                onRemove={detach}
              />
            </>
          ) : run ? (
            <>
              <AttachedRun run={run} />
              <AttachmentActions
                changeLabel="다른 기록"
                onChange={() => setSheet('run')}
                onRemove={detach}
              />
            </>
          ) : (
            <View style={styles.attachChoices}>
              <AttachChoice
                icon={ImagePlus}
                title="사진 첨부"
                detail="앨범이나 카메라"
                onPress={() => setSheet('photo')}
              />
              <AttachChoice
                icon={Footprints}
                title="달리기 기록 첨부"
                detail="캘린더에서 고르기"
                onPress={() => setSheet('run')}
              />
            </View>
          )}
        </ComposeSection>
        {/* 2. 내용과 태그는 따로 쓴다. 올릴 때 본문 아래에 태그 줄로 붙는다 */}
        <ComposeSection title="내용">
          <Field
            accessibilityLabel="게시물 내용"
            placeholder="오늘 달리기는 어땠나요?"
            value={body}
            onChangeText={setBody}
            multiline
            maxLength={MAX_CONTENT_LENGTH}
            style={styles.composer}
          />
          <AppText variant="label" color={colors.textSubtle} align="right">
            {body.length}/{MAX_CONTENT_LENGTH}
          </AppText>
        </ComposeSection>
        <ComposeSection title="태그">
          <Field
            accessibilityLabel="태그"
            placeholder="#오운완 #달료런"
            value={tags}
            onChangeText={setTags}
            autoCapitalize="none"
            maxLength={MAX_TAG_INPUT_LENGTH}
          />
        </ComposeSection>
        {/* 3. 공개 범위와 위치 공유 */}
        <ComposeSection title="공개 범위">
          {visibilityChoices}
          <View style={styles.toggleRow}>
            <View style={styles.grow}>
              <AppText variant="body">위치 공유</AppText>
              <AppText
                variant="caption"
                color={colors.textMuted}
                numberOfLines={2}
              >
                {locationLoading
                  ? '위치를 확인하는 중이에요'
                  : location
                  ? location
                  : regionTooBroad
                  ? '설정 > 내 지역을 시·구까지 고르면 공유할 수 있어요'
                  : '공유할 위치 정보가 없어요'}
              </AppText>
            </View>
            <Switch
              accessibilityLabel="위치 공유"
              value={shareLocation && !!location}
              disabled={!location}
              onValueChange={setShareLocation}
              {...switchColors(shareLocation && !!location)}
            />
          </View>
        </ComposeSection>
        {/* 4. 함께 달린 사람 */}
        <ComposeSection title="함께 달린 사람">
          <View style={styles.runnerChips}>
            {withRunners.map(runner => (
              <View key={runner.uid} style={styles.runnerChip}>
                <AppText variant="label" color={colors.primaryInk}>
                  {runner.display_name}
                </AppText>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${runner.display_name} 태그 빼기`}
                  hitSlop={8}
                  onPress={() =>
                    setWithRunners(old =>
                      old.filter(item => item.uid !== runner.uid),
                    )
                  }
                >
                  <X size={14} color={colors.primaryInk} />
                </Pressable>
              </View>
            ))}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="함께 달린 사람 태그"
              onPress={() => setSheet('runners')}
              style={({ pressed }) => [
                styles.addRunner,
                pressed && styles.pressedChoice,
              ]}
            >
              <UserPlus size={15} color={colors.textMuted} />
              <AppText variant="label" color={colors.textMuted}>
                {withRunners.length > 0 ? '더 태그하기' : '친구 태그하기'}
              </AppText>
            </Pressable>
          </View>
        </ComposeSection>
        {error && (
          <AppText color={colors.danger} accessibilityRole="alert">
            {error}
          </AppText>
        )}
        <Button label="게시물 올리기" disabled={!attached} onPress={submit} />
      </ScrollView>
      <PhotoSourceSheet
        visible={sheet === 'photo'}
        onClose={() => setSheet(null)}
        onCamera={() => selectPhoto(true)}
        onAlbum={() => selectPhoto(false)}
      />
      {sheet === 'run' && (
        <RunPickerSheet
          selectedId={run?.run_id}
          onPick={pickRun}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'runners' && (
        <RunnerTagSheet
          selected={withRunners}
          onDone={setWithRunners}
          onClose={() => setSheet(null)}
        />
      )}
    </Page>
  );
}
function ComposeSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.composeSection}>
      <View style={styles.composeHeading}>
        <AppText variant="subheading" accessibilityRole="header">
          {title}
        </AppText>
        {hint && (
          <AppText variant="caption" color={colors.textMuted}>
            {hint}
          </AppText>
        )}
      </View>
      {children}
    </View>
  );
}
function AttachChoice({
  icon: Icon,
  title,
  detail,
  onPress,
}: {
  icon: typeof Footprints;
  title: string;
  detail: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [
        styles.attachChoice,
        pressed && styles.pressedChoice,
      ]}
    >
      <View style={styles.attachIcon}>
        <Icon size={24} color={colors.primaryInk} />
      </View>
      <AppText variant="subheading">{title}</AppText>
      <AppText variant="caption" color={colors.textMuted}>
        {detail}
      </AppText>
    </Pressable>
  );
}
function AttachmentActions({
  changeLabel,
  onChange,
  onRemove,
}: {
  changeLabel: string;
  onChange: () => void;
  onRemove: () => void;
}) {
  return (
    <View style={styles.attachmentActions}>
      <Button
        label={changeLabel}
        size="md"
        variant="secondary"
        onPress={onChange}
        style={styles.grow}
      />
      <Button
        label="첨부 빼기"
        size="md"
        variant="ghost"
        onPress={onRemove}
        style={styles.grow}
      />
    </View>
  );
}
// 첨부한 달리기 기록 미리보기. 피드에서는 같은 기록이 "공유한 러닝 기록" 칸으로 보인다
function AttachedRun({ run }: { run: RunDocument }) {
  return (
    <View testID="composer-attached-run" style={styles.composerRun}>
      <View style={styles.runTileTop}>
        <Footprints size={18} color={colors.primaryInk} />
        <AppText variant="label" color={colors.textMuted}>
          {`${runDay(run)} · ${runTime(run)}`}
        </AppText>
      </View>
      <View style={styles.runTileDistance}>
        <AppText style={styles.attachedRunNumber}>
          {run.distance_km.toFixed(2)}
        </AppText>
        <AppText variant="subheading" color={colors.primaryInk}>
          km
        </AppText>
      </View>
      <AppText variant="caption" color={colors.textMuted}>
        {[
          formatDuration(run.duration_sec),
          run.avg_pace_sec > 0 ? `${formatPace(run.avg_pace_sec)} /km` : '',
          `${run.calories} kcal`,
        ]
          .filter(Boolean)
          .join(' · ')}
      </AppText>
    </View>
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
            onProfile={onProfile}
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
  wanted,
  bottomInset,
  onBack,
  onSearch,
  onWrite,
  onOpen,
  onComments,
  onProfile,
}: {
  wanted: (post: SocialPost) => boolean;
  bottomInset: number;
  onBack: () => void;
  onSearch: () => void;
  onWrite: () => void;
  onOpen: (id: string) => void;
  onComments: (id: string) => void;
  onProfile: (uid: string) => void;
}) {
  const feed = useServerFeed('exploreFeed');
  const posts = feed.posts.filter(wanted);
  return (
    <Page title="탐색" testID="section-explore" hideHeader onBack={onBack}>
      <FeedScroll
        id="community-explore"
        bottomInset={bottomInset + spacing.xl}
        refreshing={feed.status === 'loading'}
        onRefresh={feed.refresh}
        header={
          <SectionHeader label="EXPLORE" accessibilityLabel="탐색">
            <IconButton
              icon={Search}
              accessibilityLabel="러너 검색"
              onPress={onSearch}
            />
            <IconButton
              icon={Plus}
              accessibilityLabel="글쓰기"
              onPress={onWrite}
            />
          </SectionHeader>
        }
      >
        {feed.status === 'loading' ? (
          <Loading />
        ) : feed.status === 'error' ? (
          <Failure retry={feed.refresh} />
        ) : posts.length === 0 ? (
          <Empty
            title="아직 둘러볼 글이 없어요"
            detail="새로운 러너들이 글을 올리면 여기에 모여요."
          />
        ) : (
          posts.map(post => (
            <PostCard
              key={post.post_id}
              post={post}
              onComments={() => onComments(post.post_id)}
              onOpen={() => onOpen(post.post_id)}
              onProfile={onProfile}
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
      </FeedScroll>
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
          <View style={styles.searchTools}>
            <Field
              accessibilityLabel="러너 검색"
              placeholder="닉네임 앞부분, 또는 @아이디로 검색"
              value={name}
              onChangeText={setName}
              maxLength={21}
              returnKeyType="search"
              onSubmitEditing={load}
              style={styles.peopleInput}
            />
            <Button
              label="검색"
              size="md"
              disabled={!name.trim() || status === 'loading'}
              onPress={load}
            />
          </View>
        )}
        {!ranking && status === 'success' && users.length > 0 && (
          <AppText variant="label" color={colors.textMuted}>
            검색 결과 {users.length}명
          </AppText>
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
            style={[styles.profileViewButton]}
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
  hideBack = false,
  onBack,
  onPost,
  onEdit,
  onSettings,
  onRuns,
  onTogether,
  onComments,
  onMessage,
  onConnections,
  onProfile,
  onWrite,
}: {
  uid: string;
  // 화면 아래에 떠 있는 바에 끝이 가려지지 않도록 비워 둘 높이
  bottomInset?: number;
  // 서브 네비게이션의 "내 프로필"처럼 뒤로 가기 버튼이 필요 없는 자리에서
  hideBack?: boolean;
  onBack: () => void;
  onPost: (id: string) => void;
  onEdit?: (post: SocialPost) => void;
  // 내 프로필 메뉴의 "프로필 설정"
  onSettings?: () => void;
  // 전체 러닝 기록 화면을 연다
  onRuns?: () => void;
  onTogether?: (friendUid: string) => void;
  onMessage: (uid: string) => void;
  onComments: (id: string) => void;
  onConnections?: (kind: ConnectionKind) => void;
  // 게시물에 함께 달린 사람으로 태그된 다른 러너의 프로필을 연다
  onProfile?: (uid: string) => void;
  // 있으면 머리글에 글쓰기(+) 버튼을 둔다(서브 네비게이션의 내 프로필)
  onWrite?: () => void;
}) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [runner, setRunner] = useState<RunnerProfile | null>(null);
  const [postView, setPostView] = useState<'list' | 'grid'>('list');
  const [runsOpen, setRunsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState<boolean | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
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
  const blocked = runner?.blocked === true;
  const unblock = () =>
    runInBackground({
      label: '차단 해제 중',
      successLabel: '차단을 해제했어요',
      failureLabel: '차단을 해제하지 못했어요',
      describeError: socialError,
      task: () => socialRequest('blockUser', { uid, blocked: false }),
      onSuccess: () => setRevision(v => v + 1),
    });
  const mine = uid === myUid();
  const blockRunner = () =>
    Alert.alert(
      `${profile?.display_name ?? '러너'}님을 차단할까요?`,
      '서로의 팔로우가 끊기고, 이 러너의 글과 댓글이 보이지 않아요. 차단은 설정에서 해제할 수 있어요.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '차단',
          style: 'destructive',
          onPress: () =>
            runInBackground({
              label: '차단하는 중',
              successLabel: `${profile?.display_name ?? '러너'}님을 차단했어요`,
              failureLabel: '차단하지 못했어요',
              retryable: false,
              describeError: socialError,
              task: () => socialRequest('blockUser', { uid, blocked: true }),
              onSuccess: () => setRevision(v => v + 1),
            }),
        },
      ],
    );
  // 공개 범위 설정. 화면은 바로 바꾸고, 실패하면 되돌린다
  const togglePrivacy = (
    key: 'runsPublic' | 'connectionsPublic',
    field: 'runs_public' | 'connections_public',
  ) => {
    const current = runner?.privacy;
    if (!current) return;
    const next = !current[field];
    const set = (value: boolean) =>
      setRunner(old =>
        old?.privacy
          ? { ...old, privacy: { ...old.privacy, [field]: value } }
          : old,
      );
    set(next);
    runInBackground({
      label: '',
      failureLabel: '공개 설정을 바꾸지 못했어요',
      silent: true,
      retryable: false,
      describeError: socialError,
      task: () => socialRequest('setPrivacy', { [key]: next }),
      onFailure: () => set(!next),
    });
  };
  const state = (on?: boolean) => (on === false ? '꺼짐' : '켜짐');
  const reportItem: ActionSheetItem = {
    label: '신고',
    accessibilityLabel: '러너 신고',
    icon: Flag,
    onPress: () => setReportOpen(true),
  };
  const menuItems: ActionSheetItem[] = mine
    ? [
        ...(onSettings
          ? [
              {
                label: '프로필 설정',
                icon: SettingsIcon,
                onPress: onSettings,
              },
            ]
          : []),
        {
          label: `러닝 기록 공개 · ${state(runner?.privacy?.runs_public)}`,
          icon: FootprintsIcon,
          onPress: () => togglePrivacy('runsPublic', 'runs_public'),
        },
        {
          label: `팔로워·팔로잉 공개 · ${state(
            runner?.privacy?.connections_public,
          )}`,
          icon: Users,
          onPress: () =>
            togglePrivacy('connectionsPublic', 'connections_public'),
        },
      ]
    : blocked
    ? [{ label: '차단 해제', icon: Ban, onPress: unblock }, reportItem]
    : [
        reportItem,
        {
          label: `${profile?.display_name ?? '러너'} 차단`,
          icon: Ban,
          danger: true,
          onPress: blockRunner,
        },
      ];
  return (
    <Page
      title="러너 프로필"
      hideBack={hideBack}
      testID={hideBack ? 'section-profile' : undefined}
      headerRight={
        onWrite && (
          <IconButton
            icon={Plus}
            accessibilityLabel="글쓰기"
            onPress={onWrite}
          />
        )
      }
      // 내 프로필과 다른 러너의 프로필 모두 맨 위에 아이디를 보여 준다. 아이디가 없는 기존 사용자는 닉네임을 보여 준다
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
        onScrollBeginDrag={() => setRunsOpen(false)}
        contentContainerStyle={[
          styles.content,
          styles.profileContent,
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
              <Card
                tone="flat"
                padded={false}
                style={[styles.runnerHero, mine && styles.runnerHeroMine]}
              >
                <View style={styles.runnerIdentity}>
                  <Avatar uri={profile.profile_image} size={80} />
                  <View style={styles.runnerIdentityText}>
                    <AppText variant="heading" numberOfLines={1}>
                      {profile.display_name}
                    </AppText>
                    <View style={styles.runnerLine}>
                      <MapPin size={14} color={colors.textMuted} />
                      <AppText variant="caption" color={colors.textMuted}>
                        {profile.region}
                      </AppText>
                    </View>
                  </View>
                  <View style={styles.runnerMenu}>
                    <IconButton
                      icon={MoreHorizontal}
                      variant="plain"
                      accessibilityLabel="프로필 메뉴"
                      onPress={() => setMenuOpen(true)}
                    />
                  </View>
                </View>
                {/* 세 칸은 폭이 같고 글자는 작고 연하게, 숫자는 한 단계 크고 진하게 보여 준다 */}
                <View style={styles.runnerCounts}>
                  <View style={styles.runnerCount}>
                    <AppText variant="caption" color={colors.textMuted}>
                      게시물
                    </AppText>
                    <AppText variant="subheading">
                      {blocked ? 0 : runner?.post_count ?? posts.length}
                    </AppText>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="팔로워 목록"
                    style={styles.runnerCount}
                    onPress={() => onConnections?.('followers')}
                  >
                    <AppText variant="caption" color={colors.textMuted}>
                      팔로워
                    </AppText>
                    <AppText variant="subheading">
                      {profile.follower_count}
                    </AppText>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="팔로잉 목록"
                    style={styles.runnerCount}
                    onPress={() => onConnections?.('following')}
                  >
                    <AppText variant="caption" color={colors.textMuted}>
                      팔로잉
                    </AppText>
                    <AppText variant="subheading">
                      {profile.following_count}
                    </AppText>
                  </Pressable>
                </View>
                {blocked && (
                  <>
                    <AppText variant="caption" color={colors.textMuted}>
                      차단한 러너예요. 차단을 해제하면 글과 기록을 다시 볼 수
                      있어요.
                    </AppText>
                    <Button
                      label="차단 해제"
                      size="md"
                      variant="secondary"
                      onPress={unblock}
                    />
                  </>
                )}
                {uid !== myUid() && !blocked && (
                  <View style={styles.runnerActions}>
                    <Button
                      style={styles.runnerAction}
                      label={following ? '팔로잉' : '팔로우'}
                      size="md"
                      variant={following ? 'secondary' : 'primary'}
                      onPress={follow}
                    />
                    <Button
                      style={styles.runnerAction}
                      icon={MessageSquare}
                      label="메시지 보내기"
                      size="md"
                      variant="secondary"
                      onPress={() => onMessage(uid)}
                    />
                  </View>
                )}
                {friend && onTogether && (
                  <Button
                    label="같이 달리기 요청"
                    size="md"
                    onPress={() => onTogether(uid)}
                  />
                )}
              </Card>
              {!blocked && runner && (
                // 캐릭터 구역은 홈처럼 화면 양끝까지 채운다
                <View testID="profile-stats-bleed" style={styles.profileBleed}>
                  <RunnerStatsCard
                    runner={runner}
                    runsOpen={runsOpen}
                    onToggleRuns={setRunsOpen}
                    onOpenRuns={onRuns}
                  />
                </View>
              )}
              {!blocked && (
                <View style={styles.profileSectionHeader}>
                  <AppText variant="subheading">최근 게시물</AppText>
                  <ProfileViewSwitch
                    label="게시물"
                    value={postView}
                    onChange={setPostView}
                  />
                </View>
              )}
              {blocked ? null : posts.length === 0 ? (
                <Empty
                  title="공개된 글이 없어요"
                  detail="볼 수 있는 최근 게시물이 없습니다."
                />
              ) : postView === 'grid' ? (
                // 최근 게시물도 화면 양끝까지. 두 칸 사이만 가늘게 띄운다
                <View
                  testID="profile-posts-grid"
                  style={[styles.profileBleed, styles.profileGrid]}
                >
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
                // 목록 보기는 피드와 같은 모양으로 화면 양끝까지 쓴다
                <View testID="profile-posts-list" style={styles.profileBleed}>
                  {posts.map(post => (
                    <PostCard
                      key={post.post_id}
                      post={post}
                      onComments={() => onComments(post.post_id)}
                      onOpen={() => onPost(post.post_id)}
                      // 지금 보고 있는 프로필의 주인은 다시 열지 않는다
                      onProfile={other => {
                        if (other !== uid) onProfile?.(other);
                      }}
                      onEdit={onEdit && (() => onEdit(post))}
                    />
                  ))}
                </View>
              )}
            </>
          )
        )}
      </ScrollView>
      {menuOpen !== null && (
        <ActionSheet
          visible={menuOpen}
          onClose={() => setMenuOpen(false)}
          items={menuItems}
        />
      )}
      {reportOpen && (
        <ReportSheet
          target={{ type: 'user', id: uid }}
          note={
            blocked
              ? undefined
              : '이 러너가 보이지 않게 하려면 차단도 해 주세요.'
          }
          onClose={() => setReportOpen(false)}
          onSubmit={(reason, detail) =>
            sendReport({ type: 'user', id: uid }, reason, detail)
          }
        />
      )}
    </Page>
  );
}
// 러너의 전체 러닝 기록. 프로필의 발자국 말풍선에서 "자세히 보기"로 들어온다
function RunsPage({ uid, onBack }: { uid: string; onBack: () => void }) {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    'loading',
  );
  const [more, setMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let live = true;
    setStatus('loading');
    socialRequest<{ runs: RunSummary[]; hasMore: boolean }>('profileRuns', {
      uid,
    })
      .then(result => {
        if (!live) return;
        setRuns(result.runs);
        setMore(result.hasMore);
        setStatus('success');
      })
      .catch(() => {
        if (live) setStatus('error');
      });
    return () => {
      live = false;
    };
  }, [uid, revision]);
  const loadMore = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    setMoreError(false);
    try {
      const result = await socialRequest<{
        runs: RunSummary[];
        hasMore: boolean;
      }>('profileRuns', { uid, afterMs: runs.at(-1)?.startedAtMs });
      setRuns(old => [...old, ...result.runs]);
      setMore(result.hasMore);
    } catch {
      setMoreError(true);
    } finally {
      setLoadingMore(false);
    }
  };
  return (
    <Page title="러닝 기록" onBack={onBack}>
      <ScrollView contentContainerStyle={styles.content}>
        {status === 'loading' ? (
          <Loading />
        ) : status === 'error' ? (
          <Failure retry={() => setRevision(v => v + 1)} />
        ) : runs.length === 0 ? (
          <Empty
            title="아직 완료한 러닝이 없어요"
            detail="달리기를 마치면 여기에 쌓여요."
          />
        ) : (
          runs.map((run, index) => (
            <Card
              key={run.startedAtMs ?? index}
              tone="flat"
              padded={false}
              style={styles.runRow}
            >
              <AppText variant="caption" color={colors.textMuted}>
                {run.day}
              </AppText>
              <View style={styles.runValues}>
                <AppText variant="heading">
                  {run.distance_km.toFixed(2)}km
                </AppText>
                <AppText variant="caption" color={colors.textMuted}>
                  {formatDuration(run.duration_sec)} ·{' '}
                  {run.avg_pace_sec ? formatPace(run.avg_pace_sec) : '—'} /km
                </AppText>
              </View>
            </Card>
          ))
        )}
        {moreError && (
          <AppText color={colors.danger}>
            이전 기록을 불러오지 못했어요. 다시 시도해 주세요.
          </AppText>
        )}
        {more && (
          <Button
            label={loadingMore ? '불러오는 중…' : '이전 기록 더 보기'}
            variant="secondary"
            disabled={loadingMore}
            onPress={loadMore}
          />
        )}
      </ScrollView>
    </Page>
  );
}

function SavedPage({
  wanted,
  onBack,
  onEdit,
  onPost,
  onProfile,
  onComments,
}: {
  wanted: (post: SocialPost) => boolean;
  onBack: () => void;
  onEdit: (post: SocialPost) => void;
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
  const shown = posts.filter(wanted);
  return (
    <Page title="저장한 게시물" onBack={onBack}>
      <ScrollView contentContainerStyle={styles.content}>
        {status === 'loading' ? (
          <Loading />
        ) : status === 'error' ? (
          <Failure retry={() => setRevision(v => v + 1)} />
        ) : shown.length === 0 ? (
          <Empty
            title="저장한 글이 없어요"
            detail="마음에 드는 글의 책갈피를 눌러 보세요."
          />
        ) : (
          shown.map(post => (
            <PostCard
              key={post.post_id}
              post={post}
              onComments={() => onComments(post.post_id)}
              onOpen={() => onPost(post.post_id)}
              onProfile={onProfile}
              onEdit={() => onEdit(post)}
            />
          ))
        )}
      </ScrollView>
    </Page>
  );
}

const styles = themedStyles(() => ({
  // 아래쪽 여백은 위보다 좁게 둔다. 세 칸 줄이 카드 바닥에서 떠 보이지 않게 한다
  runnerHero: { gap: spacing.md, paddingBottom: spacing.md },
  // 내 프로필은 숫자 줄 아래에 버튼이 없어, 아래 캐릭터 구역과의 간격만 남긴다
  runnerHeroMine: { paddingBottom: 0 },
  runnerIdentity: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  runnerIdentityText: { flex: 1, gap: 4 },
  runnerLine: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  // 오른쪽 위 구석에 붙이되 눌리는 영역은 그대로 둔다
  runnerMenu: { alignSelf: 'flex-start', marginTop: -8, marginRight: -10 },
  // 같은 폭과 여백으로 숫자와 라벨을 정렬한다.
  // 위아래 여백을 같게 두어 다른 러너의 프로필에서 숫자 줄이 아래 버튼에 붙어 보이지 않게 한다
  runnerCounts: {
    flexDirection: 'row',
    paddingVertical: 6,
  },
  runnerCount: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 6,
  },
  runnerActions: { flexDirection: 'row', gap: 10 },
  runnerAction: { flex: 1 },
  profileSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  profileViewSwitch: {
    flexDirection: 'row',
    gap: 2,
  },
  profileViewButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  // 두 칸을 양 끝에 붙여 위 구역들과 좌우 끝을 맞춘다
  // 본문 좌우 여백(spacing.xl)을 상쇄해 화면 양끝까지 닿게 한다
  profileBleed: { marginHorizontal: -spacing.xl },
  profileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.lg,
  },
  // 두 칸 사이는 2px 정도만 남긴다
  profilePostTile: {
    width: '49.7%',
    overflow: 'hidden',
  },
  // 오운완 카드(4:5)의 위아래 글자가 잘리지 않는 규격. 다른 비율의 사진은 잘릴 수 있다
  profilePostImage: { width: '100%', aspectRatio: 4 / 5 },
  profilePostPlaceholder: {
    width: '100%',
    aspectRatio: 4 / 5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primarySoft,
  },
  profilePostCaption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 6,
  },
  // 구역과 구역(프로필 카드, 캐릭터 구역, "최근 게시물" 머리글, 게시물) 사이를 같은 간격으로 넉넉히 띄운다
  profileContent: { gap: spacing.xxl },
  runRow: { gap: 4, paddingVertical: spacing.sm },
  runValues: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  screen: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  // 뒤로 가기 버튼이 없는 화면(서브 메뉴의 내 프로필). 제목은 본문과 같은 왼쪽 선에,
  // 오른쪽 버튼은 탐색·메시지 헤더의 버튼과 같은 자리에 둔다. 높이도 그 헤더들과 같다
  headerNoBack: {
    paddingHorizontal: spacing.xl,
    minHeight: SCREEN_HEADER_HEIGHT,
  },
  content: { padding: spacing.xl, paddingBottom: 60, gap: spacing.md },
  feedCanvas: { backgroundColor: colors.surface },
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
    marginBottom: spacing.xs,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  detailPost: { marginBottom: 0, borderBottomWidth: 0 },
  stackRoot: { flex: 1 },
  sectionLayer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.surface,
  },
  feedHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.surface,
  },
  feedSheet: { flex: 1, overflow: 'hidden', backgroundColor: colors.surface },
  discoveryRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
    marginBottom: 6,
  },
  discovery: { flex: 1, paddingHorizontal: spacing.md },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: 8,
  },
  postActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    gap: 2,
  },
  socialIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 아이콘과 그 오른쪽 숫자를 한 번에 누를 수 있게 묶는다. 숫자가 없으면 아이콘 칸(44)만 남는다
  socialAction: {
    minWidth: 44,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    gap: 5,
  },
  socialCount: { fontSize: 15, lineHeight: 20 },
  postCaption: { paddingHorizontal: spacing.lg, gap: 7 },
  captionText: { fontSize: 14, lineHeight: 21 },
  captionAuthor: { fontFamily: fonts.bold },
  withRunners: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  withRunnerName: { fontFamily: fonts.semibold, color: colors.text },
  postAuthorName: { fontSize: 15, lineHeight: 21 },
  postMeta: { fontSize: 12, lineHeight: 16 },
  runTile: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    gap: spacing.md,
    backgroundColor: colors.secondarySoft,
  },
  runTileTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  runTileDistance: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  runTileStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: spacing.md,
  },
  runTileNumber: {
    ...typography.numberHero,
    flexShrink: 1,
    color: colors.primaryInk,
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  textPostBody: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: -0.2,
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
  // 글쓰기: 첨부 → 내용 → 태그 → 공개 범위 → 함께 달린 사람
  composeContent: {
    padding: spacing.xl,
    paddingBottom: 60,
    gap: spacing.xxl,
  },
  composeSection: { gap: spacing.md },
  composeHeading: { gap: 2 },
  attachChoices: { flexDirection: 'row', gap: spacing.md },
  attachChoice: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primaryBorder,
    backgroundColor: colors.surface,
  },
  attachIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  pressedChoice: { opacity: 0.7 },
  attachedPhoto: { borderRadius: radius.md },
  attachmentActions: { flexDirection: 'row', gap: spacing.sm },
  composerRun: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.secondarySoft,
  },
  attachedRunNumber: {
    ...typography.numberLarge,
    color: colors.primaryInk,
  },
  choices: { flexDirection: 'row', gap: spacing.sm },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.xs,
  },
  runnerChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  runnerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
  },
  addRunner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  comment: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  reply: { marginLeft: spacing.lg },
  searchTools: { gap: spacing.sm, paddingBottom: spacing.sm },
  peopleInput: { backgroundColor: colors.surfaceMuted, borderWidth: 0 },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
}));
