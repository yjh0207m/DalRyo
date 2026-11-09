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
  Award,
  Ban,
  ChevronLeft,
  Settings as SettingsIcon,
  EyeOff,
  Footprints as FootprintsIcon,
  MapPin,
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
  ActionSheet,
  type ActionSheetItem,
  AppText,
  Button,
  Card,
  FullPhoto,
  IconButton,
  ScreenHeader,
} from '../../components/ui';
import { SCREEN_HEADER_HEIGHT } from '../../components/ui/ScreenHeader';
import { RunningShoeIcon } from '../../components/ui/RunningShoeIcon';
import { SlideScreen } from '../../navigation/slide';
import { ChatScreen } from './ChatScreen';
import { CommentsSheet } from './CommentsSheet';
import { RunnerStatsCard } from './RunnerStatsCard';
import { ConnectionsScreen, type ConnectionKind } from './ConnectionsScreen';
import { CommunitySubNav, ROW_HEIGHT, type SubNavKey } from './CommunitySubNav';
import { hasUnread, watchConversations } from '../../services/chat.service';
import {
  TAB_BAR_BODY_HEIGHT,
  tabBarBottom,
} from '../../navigation/BottomTabBar';
import { colors, fonts, radius, spacing } from '../../theme';
import { useHiddenContent } from '../../hooks/useHiddenContent';
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
        ) : feedPosts.length === 0 ? (
          <Empty
            title="아직 게시물이 없어요"
            detail="러너를 팔로우하거나, 오늘의 달리기를 기록과 함께 나눠 보세요."
          />
        ) : (
          feedPosts.map(post => (
            <PostCard
              key={post.post_id}
              post={post}
              onComments={() => showComments(post.post_id)}
              onOpen={() => showPost(post.post_id)}
              onProfile={() => showProfile(post.uid)}
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
      {chrome && section !== 'messages' && (
        <Animated.View
          testID="community-write-dock"
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
      <StatusBar barStyle="dark-content" />
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
            variant={hideBack ? 'label' : 'subheading'}
            color={hideBack ? colors.textMuted : colors.text}
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
  onProfile: () => void;
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
    }).catch(errorAlert);
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
  const hasMedia = !!post.image_url || !!post.run_id;
  return (
    <View
      testID={`community-post-${post.post_id}`}
      style={[styles.post, detail && styles.detailPost]}
    >
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
  wanted,
  bottomInset,
  onBack,
  onSearch,
  onOpen,
  onComments,
  onProfile,
}: {
  wanted: (post: SocialPost) => boolean;
  bottomInset: number;
  onBack: () => void;
  onSearch: () => void;
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
          <View style={styles.exploreHeader}>
            <AppText
              variant="label"
              color={colors.textMuted}
              accessibilityRole="header"
              accessibilityLabel="탐색"
            >
              EXPLORE
            </AppText>
            <IconButton
              icon={Search}
              accessibilityLabel="러너 검색"
              onPress={onSearch}
            />
          </View>
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
}) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [runner, setRunner] = useState<RunnerProfile | null>(null);
  const [postView, setPostView] = useState<'list' | 'grid'>('list');
  const [runsOpen, setRunsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState<boolean | null>(null);
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
    ? [{ label: '차단 해제', icon: Ban, onPress: unblock }]
    : [
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
              <Card tone="flat" padded={false} style={styles.runnerHero}>
                <View style={styles.runnerIdentity}>
                  <Avatar uri={profile.profile_image} size={80} />
                  <View style={styles.runnerIdentityText}>
                    <AppText variant="heading" numberOfLines={1}>
                      {profile.display_name}
                    </AppText>
                    {/* 칭호 기능이 생기면 실제 칭호로 바꾼다 */}
                    <View style={styles.runnerLine}>
                      <Award size={14} color={colors.primaryInk} />
                      <AppText variant="label" color={colors.primaryInk}>
                        칭호
                      </AppText>
                    </View>
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
                <RunnerStatsCard
                  runner={runner}
                  runsOpen={runsOpen}
                  onToggleRuns={setRunsOpen}
                  onOpenRuns={onRuns}
                />
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
                    onEdit={onEdit && (() => onEdit(post))}
                  />
                ))
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
              onProfile={() => onProfile(post.uid)}
              onEdit={() => onEdit(post)}
            />
          ))
        )}
      </ScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  // 아래쪽 여백은 위보다 좁게 둔다. 세 칸 줄이 카드 바닥에서 떠 보이지 않게 한다
  runnerHero: { gap: spacing.md, paddingBottom: spacing.md },
  runnerIdentity: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  runnerIdentityText: { flex: 1, gap: 4 },
  runnerLine: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  // 오른쪽 위 구석에 붙이되 눌리는 영역은 그대로 둔다
  runnerMenu: { alignSelf: 'flex-start', marginTop: -8, marginRight: -10 },
  // 같은 폭과 여백으로 숫자와 라벨을 정렬한다.
  runnerCounts: {
    flexDirection: 'row',
    paddingTop: spacing.md,
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
  profileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  profilePostTile: {
    width: '48%',
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
  profilePostCaption: { padding: 10, gap: 6 },
  // 카드와 카드, 카드와 "최근 게시물" 머리글 사이를 같은 간격으로 맞춘다
  profileContent: { gap: spacing.lg },
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
  // 뒤로 가기 버튼이 없으면 제목을 본문과 같은 왼쪽 선에 맞춘다
  headerNoBack: { paddingLeft: spacing.xl, minHeight: SCREEN_HEADER_HEIGHT },
  content: { padding: spacing.xl, paddingBottom: 60, gap: spacing.md },
  feedCanvas: { backgroundColor: colors.surface },
  // 오른쪽 아래에 떠 있는 원형 글쓰기 버튼. 서브 네비게이션이 펼쳐지면 위로 비켜 준다
  writeFab: { position: 'absolute', right: spacing.xl },
  writeButton: {
    width: WRITE_SIZE,
    height: WRITE_SIZE,
    borderRadius: WRITE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryAction,
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
    marginBottom: spacing.sm,
    paddingBottom: spacing.lg,
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
  exploreHeader: {
    height: SCREEN_HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  textPostBody: {
    fontFamily: fonts.semibold,
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
});
