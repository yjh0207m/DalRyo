import React, {useEffect, useRef, useState} from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  ScrollView,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const SCREEN_W = Dimensions.get('window').width;
const GRID_CELL = (SCREEN_W - 32 - 4) / 3; // 32 = horizontal padding, 4 = 2 gaps
import {SafeAreaView} from 'react-native-safe-area-context';
import {
  subscribeMyFeed,
  subscribePublicPosts,
  subscribeMyPosts,
  getPostInteractions,
  toggleLike,
  toggleJoin,
  toggleSave,
  type FeedPost,
} from '../../services/feed.service';
import {WritePostScreen} from './WritePostScreen';
import {CommentModal} from './CommentModal';
import {NotificationModal} from './NotificationModal';
import {ChatModal} from './ChatModal';
import {UserProfileModal} from './UserProfileModal';
import type {UserDocument} from '../../types/user.types';

const images = {avatar: require('../../assets/images/dalryo-avatar.png')};

const MINT = '#58CFA6';
const MINT_DEEP = '#2BAF85';
const TEXT = '#1A1A1A';
const MUTED = '#9A9A9A';
const CARD_BG = '#FFFFFF';
const CREAM = '#F4FAF7';

type Tab = '오늘' | '팔로잉' | '탐색' | '프로필';
const TABS: Tab[] = ['오늘', '팔로잉', '탐색', '프로필'];

type Props = {user: UserDocument | null};

export function CommunityScreen({user}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('오늘');
  const [showWrite, setShowWrite] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  const [exploreQuery, setExploreQuery] = useState('');
  const [profileTarget, setProfileTarget] = useState<{uid: string; name: string} | null>(null);
  const indicatorAnim = useRef(new Animated.Value(0)).current;

  const handleProfilePress = (uid: string, name: string) => {
    if (uid === user?.uid) {
      handleTabChange('프로필');
    } else {
      setProfileTarget({uid, name});
    }
  };

  const handleHashtagPress = (tag: string) => {
    setExploreQuery(tag);
    handleTabChange('탐색');
  };

  const handleTabChange = (tab: Tab) => {
    Animated.spring(indicatorAnim, {
      toValue: TABS.indexOf(tab),
      useNativeDriver: false,
      tension: 90,
      friction: 14,
    }).start();
    setActiveTab(tab);
  };

  if (showWrite) {
    return (
      <WritePostScreen
        user={user}
        onClose={() => setShowWrite(false)}
        onPosted={() => setShowWrite(false)}
      />
    );
  }

  const indicatorLeft = indicatorAnim.interpolate({
    inputRange: TABS.map((_, i) => i),
    outputRange: TABS.map((_, i) => `${i * 25}%`),
  });

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={CREAM} />

      {/* 헤더 */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerLogo}>달료</Text>
          <Text style={styles.headerSub}>오늘도 함께 달려요 🏃</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity activeOpacity={0.75} style={styles.iconBtn} onPress={() => setShowNotifications(true)}>
            <Text style={styles.iconBtnText}>🔔</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.75} style={styles.iconBtn} onPress={() => setShowMessages(true)}>
            <Text style={styles.iconBtnText}>💬</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 탭바 */}
      <View style={styles.tabBar}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            activeOpacity={0.8}
            onPress={() => handleTabChange(tab)}
            style={styles.tabItem}>
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
        <Animated.View style={[styles.tabIndicator, {left: indicatorLeft}]} />
      </View>

      {activeTab === '오늘' && <TodayTab user={user} onWrite={() => setShowWrite(true)} onProfilePress={handleProfilePress} onHashtagPress={handleHashtagPress} />}
      {activeTab === '팔로잉' && <CrewTab user={user} onWrite={() => setShowWrite(true)} onProfilePress={handleProfilePress} onHashtagPress={handleHashtagPress} />}
      {activeTab === '탐색' && <ExploreTab user={user} externalQuery={exploreQuery} onExternalQueryConsumed={() => setExploreQuery('')} onProfilePress={handleProfilePress} onHashtagPress={handleHashtagPress} />}
      {activeTab === '프로필' && <MeTab user={user} onWrite={() => setShowWrite(true)} onProfilePress={handleProfilePress} onHashtagPress={handleHashtagPress} />}

      {activeTab !== '프로필' && (
        <TouchableOpacity activeOpacity={0.86} onPress={() => setShowWrite(true)} style={styles.fab}>
          <Text style={[styles.fabText, {transform: [{scaleX: -1}]}]}>✏️</Text>
        </TouchableOpacity>
      )}

      <NotificationModal
        visible={showNotifications}
        onClose={() => setShowNotifications(false)}
      />
      <ChatModal
        visible={showMessages}
        onClose={() => setShowMessages(false)}
        myName={user?.display_name ?? '나'}
      />
      {profileTarget && (
        <UserProfileModal
          visible={!!profileTarget}
          uid={profileTarget.uid}
          name={profileTarget.name}
          onClose={() => setProfileTarget(null)}
        />
      )}
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────
// 오늘 탭: 오늘 날짜 기준 게시물 + 챌린지 배너
// ─────────────────────────────────────────────────────────────
type SharedCardCallbacks = {
  onProfilePress: (uid: string, name: string) => void;
  onHashtagPress: (tag: string) => void;
};

function TodayTab({user, onWrite, onProfilePress, onHashtagPress}: {user: UserDocument | null; onWrite: () => void} & SharedCardCallbacks) {
  const [posts, setPosts] = useState<FeedPost[]>([]);

  useEffect(() => {
    return subscribePublicPosts(all => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      setPosts(all.filter(p => {
        const t = (p.created_at as any)?.toDate?.();
        return t ? t >= todayStart : false;
      }));
    });
  }, []);

  const today = new Date();
  const dateLabel = `${today.getMonth() + 1}월 ${today.getDate()}일 ${['일', '월', '화', '수', '목', '금', '토'][today.getDay()]}요일`;

  return (
    <FlatList
      data={posts}
      keyExtractor={item => item.post_id}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={
        <>
          <View style={styles.todayBanner}>
            <Text style={styles.todayDate}>{dateLabel}</Text>
            <Text style={styles.todayTitle}>오늘 달린 사람들의{'\n'}이야기를 들어볼까요? 🌿</Text>
          </View>
          <ChallengePill />
        </>
      }
      ListEmptyComponent={
        <EmptyDiary
          emoji="☀️"
          title="오늘 첫 러닝 일지를 써볼까요?"
          sub="오늘 달린 이야기를 달료 친구들과 나눠요"
          onWrite={onWrite}
        />
      }
      renderItem={({item}) => <DiaryCard post={item} user={user} onProfilePress={onProfilePress} onHashtagPress={onHashtagPress} />}
      ItemSeparatorComponent={() => <View style={{height: 12}} />}
    />
  );
}

// ─────────────────────────────────────────────────────────────
// 크루 탭: 팔로잉 피드
// ─────────────────────────────────────────────────────────────
function CrewTab({user, onWrite, onProfilePress, onHashtagPress}: {user: UserDocument | null; onWrite: () => void} & SharedCardCallbacks) {
  const [posts, setPosts] = useState<FeedPost[]>([]);

  useEffect(() => subscribeMyFeed(setPosts), []);

  return (
    <FlatList
      data={posts}
      keyExtractor={item => item.post_id}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={
        <View style={styles.sectionLabel}>
          <Text style={styles.sectionLabelText}>👥 내 팔로우의 러닝 일지</Text>
        </View>
      }
      ListEmptyComponent={
        <EmptyDiary
          emoji="👟"
          title="팔로우를 모아볼까요?"
          sub={'친구를 팔로우하면\n여기서 일지를 볼 수 있어요'}
          onWrite={onWrite}
        />
      }
      renderItem={({item}) => <DiaryCard post={item} user={user} onProfilePress={onProfilePress} onHashtagPress={onHashtagPress} />}
      ItemSeparatorComponent={() => <View style={{height: 12}} />}
    />
  );
}

// ─────────────────────────────────────────────────────────────
// 탐색 탭
// ─────────────────────────────────────────────────────────────
function ExploreTab({user, externalQuery, onExternalQueryConsumed, onProfilePress, onHashtagPress}: {user: UserDocument | null; externalQuery: string; onExternalQueryConsumed: () => void} & SharedCardCallbacks) {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);

  useEffect(() => subscribePublicPosts(setPosts), []);

  useEffect(() => {
    if (externalQuery) {
      setQuery(externalQuery);
      onExternalQueryConsumed();
    }
  }, [externalQuery]);

  const myUid = user?.uid;
  const others = posts.filter(p => p.uid !== myUid);
  const filtered = query.trim()
    ? others.filter(p =>
        p.text.toLowerCase().includes(query.toLowerCase()) ||
        p.author_name.toLowerCase().includes(query.toLowerCase()) ||
        p.hashtags.some(h => h.toLowerCase().includes(query.toLowerCase())),
      )
    : others;

  return (
    <View style={{flex: 1}}>
      <View style={styles.searchWrap}>
        <View style={[styles.searchBar, focused && styles.searchBarFocused]}>
          <Text style={{fontSize: 16}}>🔍</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="이름, 태그, 기록으로 탐색해요"
            placeholderTextColor="#B8B8B8"
            style={styles.searchInput}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Text style={styles.clearBtn}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {!query && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagScroll} contentContainerStyle={styles.tagScrollContent}>
          {['#오운완', '#러닝팁', '#코스추천', '#같이달리기', '#새벽런', '#마라톤'].map(tag => (
            <TouchableOpacity key={tag} onPress={() => setQuery(tag.slice(1))} style={styles.tagChip}>
              <Text style={styles.tagChipText}>{tag}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <FlatList
        data={filtered}
        keyExtractor={item => item.post_id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <EmptyDiary
            emoji="🔍"
            title={query ? '검색 결과가 없어요' : '아직 게시물이 없어요'}
            sub={query ? `"${query}" 에 맞는 일지가 없어요` : '탐색 피드가 곧 채워질 거예요!'}
          />
        }
        renderItem={({item}) => <DiaryCard post={item} user={user} onProfilePress={onProfilePress} onHashtagPress={onHashtagPress} />}
        ItemSeparatorComponent={() => <View style={{height: 10}} />}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// 나 탭: 아테리트 프로필 스타일
// ─────────────────────────────────────────────────────────────
type ViewMode = 'grid' | 'list';

function MeTab({user, onWrite, onProfilePress, onHashtagPress}: {user: UserDocument | null; onWrite: () => void} & SharedCardCallbacks) {
  const [myPosts, setMyPosts] = useState<FeedPost[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  useEffect(() => subscribeMyPosts(setMyPosts), []);

  const totalKm = myPosts.reduce((acc, p) => acc + (p.distance_km ?? 0), 0);

  return (
    <FlatList
      key={viewMode}
      data={myPosts}
      keyExtractor={item => item.post_id}
      numColumns={viewMode === 'grid' ? 3 : 1}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.listContent}
      columnWrapperStyle={viewMode === 'grid' ? styles.gridRow : undefined}
      ListHeaderComponent={
        <AthleteHeader
          user={user}
          postCount={myPosts.length}
          totalKm={totalKm}
          viewMode={viewMode}
          onToggleView={setViewMode}
          onWrite={onWrite}
        />
      }
      ListEmptyComponent={
        <View style={styles.meEmptyWrap}>
          <Text style={styles.meEmptyText}>아직 러닝 일지가 없어요</Text>
          <TouchableOpacity activeOpacity={0.85} onPress={onWrite} style={styles.emptyBtn}>
            <Text style={styles.emptyBtnText}>첫 일지 쓰기</Text>
          </TouchableOpacity>
        </View>
      }
      renderItem={({item}) =>
        viewMode === 'grid'
          ? <GridPostItem post={item} />
          : <DiaryCard post={item} user={user} onProfilePress={onProfilePress} onHashtagPress={onHashtagPress} />
      }
      ItemSeparatorComponent={viewMode === 'list' ? () => <View style={{height: 12}} /> : undefined}
    />
  );
}

function AthleteHeader({user, postCount, totalKm, viewMode, onToggleView, onWrite}: {
  user: UserDocument | null;
  postCount: number;
  totalKm: number;
  viewMode: ViewMode;
  onToggleView: (mode: ViewMode) => void;
  onWrite: () => void;
}) {
  return (
    <View style={styles.athleteHeader}>
      {/* 프로필 상단 */}
      <View style={styles.athleteTop}>
        <Image source={images.avatar} resizeMode="cover" style={styles.athleteAvatar} />
        <View style={styles.athleteInfo}>
          <Text style={styles.athleteName}>{user?.display_name ?? '달리너'}</Text>
          {!!user?.region && <Text style={styles.athleteRegion}>📍 {user.region}</Text>}
          <View style={styles.followRow}>
            <TouchableOpacity activeOpacity={0.8}>
              <Text style={styles.followStat}><Text style={styles.followNum}>{user?.follower_count ?? 0}</Text> 팔로워</Text>
            </TouchableOpacity>
            <Text style={styles.followDot}>·</Text>
            <TouchableOpacity activeOpacity={0.8}>
              <Text style={styles.followStat}><Text style={styles.followNum}>{user?.following_count ?? 0}</Text> 팔로잉</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity activeOpacity={0.8} style={styles.editBtn}>
            <Text style={styles.editBtnText}>프로필 편집</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 기록 스탯 카드 */}
      <View style={styles.athleteStats}>
        <AthleteStat label="러닝 일지" value={String(postCount)} unit="개" />
        <View style={styles.athleteStatDivider} />
        <AthleteStat label="누적 거리" value={totalKm.toFixed(1)} unit="km" />
        <View style={styles.athleteStatDivider} />
        <AthleteStat label="연속 달리기" value={user?.total_km != null ? '—' : '0'} unit="일" />
      </View>

      {/* 뱃지 행 */}
      <View style={styles.badgeRow}>
        <Text style={styles.badgeRowLabel}>획득한 뱃지</Text>
        <View style={styles.badgeList}>
          {['🏅', '⚡', '🌅'].map((b, i) => (
            <View key={i} style={styles.badge}>
              <Text style={styles.badgeEmoji}>{b}</Text>
            </View>
          ))}
          <View style={[styles.badge, styles.badgeLocked]}>
            <Text style={styles.badgeEmoji}>🔒</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity activeOpacity={0.85} onPress={onWrite} style={styles.writeBtn}>
        <Text style={styles.writeBtnText}>✏️ 오늘의 러닝 일지 쓰기</Text>
      </TouchableOpacity>

      <View style={styles.myPostsLabel}>
        <Text style={styles.myPostsLabelText}>내 러닝 일지 {postCount}개</Text>
        <View style={styles.viewToggleRow}>
          <TouchableOpacity activeOpacity={0.75} onPress={() => onToggleView('grid')} style={[styles.viewToggleBtn, viewMode === 'grid' && styles.viewToggleBtnActive]}>
            <Text style={[styles.viewToggleIcon, viewMode === 'grid' && styles.viewToggleIconActive]}>⊞</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.75} onPress={() => onToggleView('list')} style={[styles.viewToggleBtn, viewMode === 'list' && styles.viewToggleBtnActive]}>
            <Text style={[styles.viewToggleIcon, viewMode === 'list' && styles.viewToggleIconActive]}>☰</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function GridPostItem({post}: {post: FeedPost}) {
  return (
    <View style={styles.gridItem}>
      {post.image_url ? (
        <Image source={{uri: post.image_url}} style={styles.gridImage} resizeMode="cover" />
      ) : (
        <View style={styles.gridPlaceholder}>
          <Text style={styles.gridPlaceholderEmoji}>🏃</Text>
          <Text style={styles.gridPlaceholderText} numberOfLines={3}>{post.text}</Text>
        </View>
      )}
    </View>
  );
}

function AthleteStat({label, value, unit}: {label: string; value: string; unit: string}) {
  return (
    <View style={styles.athleteStatItem}>
      <View style={{flexDirection: 'row', alignItems: 'baseline', gap: 2}}>
        <Text style={styles.athleteStatValue}>{value}</Text>
        <Text style={styles.athleteStatUnit}>{unit}</Text>
      </View>
      <Text style={styles.athleteStatLabel}>{label}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// 핵심: 일지 카드
// ─────────────────────────────────────────────────────────────
function DiaryCard({post, user, compact = false, onProfilePress, onHashtagPress}: {post: FeedPost; user: UserDocument | null; compact?: boolean} & Partial<SharedCardCallbacks>) {
  const [cheered, setCheered] = useState(false);
  const [joinReq, setJoinReq] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [joinCount, setJoinCount] = useState(post.comment_count);
  const date = (post.created_at as any)?.toDate?.() ?? new Date();
  const dateStr = `${date.getMonth() + 1}.${date.getDate()} ${['일', '월', '화', '수', '목', '금', '토'][date.getDay()]}`;
  const weatherEmoji = ['☀️', '⛅', '🌥️', '🌧️'][date.getDate() % 4];

  useEffect(() => {
    getPostInteractions(post.post_id).then(s => {
      setCheered(s.liked);
      setJoinReq(s.joined);
      setSaved(s.saved);
    }).catch(() => {});
  }, [post.post_id]);

  const handleCheer = async () => {
    const prev = cheered;
    setCheered(!prev);
    setLikeCount(c => c + (prev ? -1 : 1));
    try { await toggleLike(post.post_id); }
    catch { setCheered(prev); setLikeCount(c => c + (prev ? 1 : -1)); }
  };

  const handleJoin = async () => {
    const prev = joinReq;
    setJoinReq(!prev);
    setJoinCount(c => c + (prev ? -1 : 1));
    try { await toggleJoin(post.post_id); }
    catch { setJoinReq(prev); setJoinCount(c => c + (prev ? 1 : -1)); }
  };

  const handleSave = async () => {
    const prev = saved;
    setSaved(!prev);
    try { await toggleSave(post.post_id); }
    catch { setSaved(prev); }
  };

  return (
    <View style={styles.diaryCard}>
      {/* 일지 헤더: 작성자(좌) + 날짜/날씨(우) */}
      <View style={styles.diaryTop}>
        <TouchableOpacity
          activeOpacity={0.75}
          style={styles.diaryAuthorWrap}
          onPress={() => onProfilePress?.(post.uid, post.author_name)}>
          <Image source={images.avatar} resizeMode="cover" style={styles.diaryAvatar} />
          <Text style={styles.diaryAuthor}>{post.author_name}</Text>
        </TouchableOpacity>
        <View style={styles.diaryDateWrap}>
          <Text style={styles.diaryDate}>{dateStr}</Text>
          <Text style={styles.diaryWeather}>{weatherEmoji}</Text>
        </View>
      </View>

      {/* 러닝 스탯 — 거리가 히어로 */}
      {post.distance_km != null && (
        <View style={styles.diaryStats}>
          <View style={styles.diaryDistanceBlock}>
            <Text style={styles.diaryDistanceNum}>{post.distance_km.toFixed(2)}</Text>
            <Text style={styles.diaryDistanceUnit}>km</Text>
          </View>
          <View style={styles.diaryStatRight}>
            {post.avg_pace_sec != null && (
              <View style={styles.diaryStatRow}>
                <Text style={styles.diaryStatIcon}>⏱</Text>
                <Text style={styles.diaryStatVal}>{formatTime(post.avg_pace_sec)}</Text>
              </View>
            )}
            {post.calories != null && (
              <View style={styles.diaryStatRow}>
                <Text style={styles.diaryStatIcon}>🔥</Text>
                <Text style={styles.diaryStatVal}>{post.calories} kcal</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* 이미지 */}
      {!!post.image_url && !compact && (
        <Image source={{uri: post.image_url}} resizeMode="cover" style={styles.diaryImage} />
      )}

      {/* 일지 텍스트 */}
      {!!post.text && (
        <View style={styles.diaryTextWrap}>
          <Text style={styles.diaryText} numberOfLines={compact ? 2 : undefined}>
            {post.text}
          </Text>
        </View>
      )}

      {/* 해시태그 칩 */}
      {post.hashtags.length > 0 && (
        <View style={styles.hashtagRow}>
          {post.hashtags.map(tag => (
            <TouchableOpacity
              key={tag}
              activeOpacity={0.75}
              style={styles.hashtagChip}
              onPress={() => onHashtagPress?.(tag)}>
              <Text style={styles.hashtagChipText}>#{tag}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* 반응 버튼 */}
      <View style={styles.diaryReactions}>
        <View style={styles.reactionLeft}>
          <TouchableOpacity activeOpacity={0.78} onPress={handleCheer} style={styles.reactionIconBtn}>
            <Text style={styles.reactionIcon}>🔥</Text>
            <Text style={[styles.reactionCount, cheered && styles.reactionCountActive]}>{likeCount}</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.78} onPress={handleJoin} style={styles.reactionIconBtn}>
            <Text style={styles.reactionIcon}>👟</Text>
            <Text style={[styles.reactionCount, joinReq && styles.reactionCountJoin]}>{joinCount}</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.78} onPress={() => setShowComments(true)} style={styles.reactionIconBtn}>
            <Text style={styles.reactionIcon}>💬</Text>
            <Text style={styles.reactionCount}>{post.chat_count ?? 0}</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity activeOpacity={0.78} onPress={handleSave} style={styles.reactionIconBtn}>
          <Text style={[styles.reactionIcon, {opacity: saved ? 1 : 0.4}]}>🔖</Text>
        </TouchableOpacity>
      </View>

      <CommentModal
        postId={post.post_id}
        user={user}
        visible={showComments}
        onClose={() => setShowComments(false)}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// 공통 서브 컴포넌트
// ─────────────────────────────────────────────────────────────
function ChallengePill() {
  return (
    <TouchableOpacity activeOpacity={0.85} style={styles.challengePill}>
      <Text style={styles.challengePillEmoji}>🏅</Text>
      <View style={styles.challengePillText}>
        <Text style={styles.challengePillTitle}>이번 주 챌린지 · 5km 완주하고 배지 받기</Text>
        <Text style={styles.challengePillSub}>5.12 (월) ~ 5.18 (일) · 참여하기 →</Text>
      </View>
    </TouchableOpacity>
  );
}

function EmptyDiary({emoji, title, sub, onWrite}: {emoji: string; title: string; sub: string; onWrite?: () => void}) {
  return (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyEmoji}>{emoji}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubText}>{sub}</Text>
      {onWrite && (
        <TouchableOpacity activeOpacity={0.85} onPress={onWrite} style={styles.emptyBtn}>
          <Text style={styles.emptyBtnText}>일지 쓰기</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// 유틸
// ─────────────────────────────────────────────────────────────
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────────────────────
// 스타일
// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: CREAM},

  // 헤더
  header: {flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 22, paddingTop: 14, paddingBottom: 10},
  headerLogo: {color: MINT, fontSize: 26, fontWeight: '900'},
  headerSub: {color: MUTED, fontSize: 12, fontWeight: '700', marginTop: 2},
  headerRight: {flexDirection: 'row', gap: 8, paddingTop: 4},
  iconBtn: {width: 36, height: 36, borderRadius: 18, backgroundColor: CARD_BG, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E0EDE6'},
  iconBtnText: {fontSize: 17},

  // 탭
  tabBar: {flexDirection: 'row', backgroundColor: CARD_BG, borderBottomWidth: 1, borderBottomColor: '#E4EEE8', position: 'relative'},
  tabItem: {flex: 1, alignItems: 'center', paddingVertical: 13},
  tabText: {color: '#B0B0B0', fontSize: 15, fontWeight: '800'},
  tabTextActive: {color: TEXT},
  tabIndicator: {position: 'absolute', bottom: 0, width: '25%', height: 2.5, borderRadius: 2, backgroundColor: MINT},

  // 리스트 공통
  listContent: {paddingHorizontal: 16, paddingTop: 14, paddingBottom: 120},
  sectionLabel: {marginBottom: 12},
  sectionLabelText: {color: TEXT, fontSize: 15, fontWeight: '900'},

  // 오늘 탭 배너
  todayBanner: {marginBottom: 16},
  todayDate: {color: MINT_DEEP, fontSize: 13, fontWeight: '800', marginBottom: 6},
  todayTitle: {color: TEXT, fontSize: 22, fontWeight: '900', lineHeight: 32},

  // 챌린지 필
  challengePill: {flexDirection: 'row', alignItems: 'center', backgroundColor: CARD_BG, borderRadius: 16, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(88,207,166,0.2)', gap: 12},
  challengePillEmoji: {fontSize: 28},
  challengePillText: {flex: 1},
  challengePillTitle: {color: TEXT, fontSize: 14, fontWeight: '900'},
  challengePillSub: {color: MUTED, fontSize: 12, fontWeight: '700', marginTop: 3},

  // 일지 카드
  diaryCard: {backgroundColor: CARD_BG, borderRadius: 20, padding: 18, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: {width: 0, height: 2}, elevation: 2},
  diaryTop: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14},
  diaryDateWrap: {flexDirection: 'row', alignItems: 'center', gap: 6},
  diaryDate: {color: MUTED, fontSize: 13, fontWeight: '800'},
  diaryWeather: {fontSize: 16},
  diaryAuthorWrap: {flexDirection: 'row', alignItems: 'center', gap: 8},
  diaryAvatar: {width: 32, height: 32, borderRadius: 16},
  diaryAuthor: {color: TEXT, fontSize: 13, fontWeight: '900', textAlign: 'right'},
  diaryTag: {color: MINT_DEEP, fontSize: 11, fontWeight: '700', textAlign: 'right', marginTop: 1},

  // 거리 히어로
  diaryStats: {flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FBF6', borderRadius: 14, padding: 14, marginBottom: 12},
  diaryDistanceBlock: {flexDirection: 'row', alignItems: 'baseline', flex: 1},
  diaryDistanceNum: {color: MINT_DEEP, fontSize: 42, fontWeight: '900', lineHeight: 48},
  diaryDistanceUnit: {color: MINT_DEEP, fontSize: 18, fontWeight: '700', marginLeft: 4, marginBottom: 4},
  diaryStatRight: {gap: 6},
  diaryStatRow: {flexDirection: 'row', alignItems: 'center', gap: 4},
  diaryStatIcon: {fontSize: 14},
  diaryStatVal: {color: '#4A4A4A', fontSize: 14, fontWeight: '800'},

  // 이미지
  diaryImage: {width: '100%', height: 200, borderRadius: 14, marginBottom: 12},

  // 텍스트
  diaryTextWrap: {borderLeftWidth: 3, borderLeftColor: '#D6F0E6', paddingLeft: 12, marginBottom: 14},
  diaryText: {color: '#333333', fontSize: 15, fontWeight: '500', lineHeight: 24},

  // 반응
  diaryReactions: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4},
  reactionLeft: {flexDirection: 'row', gap: 16},
  reactionIconBtn: {flexDirection: 'row', alignItems: 'center', gap: 5},
  reactionIcon: {fontSize: 18},
  reactionCount: {color: '#AAAAAA', fontSize: 13, fontWeight: '800'},
  reactionCountActive: {color: MINT_DEEP},
  reactionCountJoin: {color: '#E08800'},

  // 탐색 탭
  searchWrap: {padding: 14, paddingBottom: 8},
  searchBar: {flexDirection: 'row', alignItems: 'center', backgroundColor: CARD_BG, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderColor: '#E0E8E2', gap: 10},
  searchBarFocused: {borderColor: MINT},
  searchInput: {flex: 1, color: TEXT, fontSize: 15, fontWeight: '600', padding: 0},
  clearBtn: {color: '#AAAAAA', fontSize: 15, fontWeight: '700'},
  tagScroll: {maxHeight: 48},
  tagScrollContent: {paddingHorizontal: 14, gap: 8, alignItems: 'center'},
  tagChip: {backgroundColor: CARD_BG, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: '#D8EDE4'},
  tagChipText: {color: MINT_DEEP, fontSize: 13, fontWeight: '800'},

  // 나 탭
  athleteHeader: {backgroundColor: CARD_BG, borderRadius: 20, padding: 20, marginBottom: 16},
  athleteTop: {flexDirection: 'row', alignItems: 'flex-start', gap: 16, marginBottom: 20},
  athleteAvatar: {width: 76, height: 76, borderRadius: 38, borderWidth: 3, borderColor: '#C8EFE0'},
  athleteInfo: {flex: 1, paddingTop: 4},
  athleteName: {color: TEXT, fontSize: 20, fontWeight: '900', marginBottom: 4},
  athleteRegion: {color: MUTED, fontSize: 13, fontWeight: '700', marginBottom: 10},
  followRow: {flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10},
  followStat: {color: MUTED, fontSize: 13, fontWeight: '700'},
  followNum: {color: TEXT, fontWeight: '900'},
  followDot: {color: MUTED, fontSize: 13},
  editBtn: {alignSelf: 'flex-start', borderRadius: 10, borderWidth: 1, borderColor: '#D0D0D0', paddingHorizontal: 14, paddingVertical: 6},
  editBtnText: {color: '#555555', fontSize: 13, fontWeight: '800'},
  athleteStats: {flexDirection: 'row', backgroundColor: CREAM, borderRadius: 14, padding: 16, marginBottom: 16},
  athleteStatItem: {flex: 1, alignItems: 'center'},
  athleteStatDivider: {width: 1, backgroundColor: '#D8E8E0'},
  athleteStatValue: {color: MINT_DEEP, fontSize: 22, fontWeight: '900'},
  athleteStatUnit: {color: MINT_DEEP, fontSize: 13, fontWeight: '700'},
  athleteStatLabel: {color: MUTED, fontSize: 12, fontWeight: '700', marginTop: 4},
  badgeRow: {marginBottom: 16},
  badgeRowLabel: {color: TEXT, fontSize: 14, fontWeight: '900', marginBottom: 10},
  badgeList: {flexDirection: 'row', gap: 10},
  badge: {width: 46, height: 46, borderRadius: 23, backgroundColor: '#EEF9F4', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#C4E8D4'},
  badgeLocked: {backgroundColor: '#F5F5F5', borderColor: '#E0E0E0'},
  badgeEmoji: {fontSize: 22},
  writeBtn: {backgroundColor: MINT, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 20},
  writeBtnText: {color: '#FFFFFF', fontSize: 15, fontWeight: '900'},
  myPostsLabel: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingTop: 14},
  myPostsLabelText: {color: TEXT, fontSize: 14, fontWeight: '900'},
  viewToggleRow: {flexDirection: 'row', gap: 4},
  viewToggleBtn: {width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F4F4'},
  viewToggleBtnActive: {backgroundColor: '#E0F9EE'},
  viewToggleIcon: {fontSize: 18, color: '#AAAAAA'},
  viewToggleIconActive: {color: MINT_DEEP},
  gridRow: {gap: 2},
  gridItem: {width: GRID_CELL, height: GRID_CELL, margin: 1, borderRadius: 8, overflow: 'hidden'},
  gridImage: {width: '100%', height: '100%'},
  gridPlaceholder: {width: '100%', height: '100%', backgroundColor: '#EEF9F4', alignItems: 'center', justifyContent: 'center', padding: 6},
  gridPlaceholderEmoji: {fontSize: 20, marginBottom: 4},
  gridPlaceholderText: {color: '#5A8A74', fontSize: 10, fontWeight: '700', textAlign: 'center', lineHeight: 14},
  meEmptyWrap: {alignItems: 'center', paddingTop: 32},
  meEmptyText: {color: MUTED, fontSize: 15, fontWeight: '700'},

  // 공통 빈 상태
  emptyWrap: {alignItems: 'center', paddingTop: 60, paddingHorizontal: 32},
  emptyEmoji: {fontSize: 52, marginBottom: 16},
  emptyTitle: {color: TEXT, fontSize: 18, fontWeight: '900', textAlign: 'center'},
  emptySubText: {color: MUTED, fontSize: 14, fontWeight: '700', textAlign: 'center', marginTop: 8, lineHeight: 22},
  emptyBtn: {marginTop: 24, backgroundColor: MINT, borderRadius: 22, paddingHorizontal: 26, paddingVertical: 13},
  emptyBtnText: {color: '#FFFFFF', fontSize: 15, fontWeight: '900'},

  // FAB
  fab: {position: 'absolute', right: 20, bottom: 104, width: 52, height: 52, borderRadius: 26, backgroundColor: CARD_BG, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: {width: 0, height: 4}, elevation: 8, borderWidth: 1, borderColor: '#D8EDE4'},
  fabText: {fontSize: 22},

  // 해시태그 칩 (DiaryCard 본문 아래)
  hashtagRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10},
  hashtagChip: {backgroundColor: '#EDF8F3', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4},
  hashtagChipText: {color: MINT_DEEP, fontSize: 12, fontWeight: '700'},
});
