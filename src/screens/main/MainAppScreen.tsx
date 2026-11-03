import React, {useState} from 'react';
import {ActivityIndicator, Alert, Pressable, StatusBar, StyleSheet, View} from 'react-native';
import {CommunityScreen, type CommunityLink} from '../community/CommunityScreen';
import {TogetherScreen} from '../together/TogetherScreen';
import {ParksScreen} from '../parks/ParksScreen';
import {GrowthScreen} from '../growth/GrowthScreen';
import {HomeScreen} from '../home/HomeScreen';
import {InventoryScreen} from '../profile/InventoryScreen';
import {CharacterPreviewScreen} from '../dev/CharacterPreviewScreen';
import {SettingsScreen} from '../profile/SettingsScreen';
import {BlockedUsersScreen} from '../profile/BlockedUsersScreen';
import {NotificationsScreen} from '../profile/NotificationsScreen';
import {useUnreadNotifications} from '../../hooks/useNotifications';
import {usePushNotifications} from '../../hooks/usePushNotifications';
import {GoalValueScreen} from '../run/GoalValueScreen';
import {RecordScreen} from '../run/RecordScreen';
import {CompletedRunScreen} from '../run/CompletedRunScreen';
import {RunningScreen} from '../run/RunningScreen';
import {RunStartSheet} from '../run/RunStartSheet';
import type {RunResult} from '../../hooks/useRunSession';
import {AppText, Button} from '../../components/ui';
import {BottomTabBar, type MainTab} from '../../navigation/BottomTabBar';
import {SlideScreen} from '../../navigation/slide';
import {TabPagerView, useTabPager} from '../../navigation/tabPager';
import {queueRun, uploadPendingRun} from '../../services/runOutbox.service';
import {useRunRecovery} from '../../hooks/useRunRecovery';
import {RunRecoveryScreen} from '../run/RunRecoveryScreen';
import {sessionResult} from '../../utils/runSession';
import type {RunContext, RunSessionSnapshot} from '../../types/runSession';
import {publishRoomProgress} from '../../services/room.service';
import {colors} from '../../theme';
import type {CharacterDocument, CharacterStage} from '../../types/character.types';
import type {RunDocument, RunGoalType} from '../../types/run.types';
import type {UserDocument} from '../../types/user.types';
import type {RunStartSnapshot} from '../../utils/runCompletion';
import type {NotificationTarget} from '../../utils/notifications';

type Props = {
  user: UserDocument | null;
  character: CharacterDocument | null;
  // 앱을 켠 뒤 홈 화면이 다 그려졌을 때
  onHomeReady?: () => void;
};

type RunGoal = {goalType: RunGoalType; goalValue: number | null; parkId?:string; parkName?:string; courseId?:string};

// 달리기 중에는 바텀 탭을 숨기고 전체 화면으로 진행한다.
// 시작 시점의 단계·누적 거리를 들고 다녀야 서버 반영 전에도 부화/성장 여부를 판단할 수 있다
type RunStart = {context: RunContext; restore?: RunSessionSnapshot; goal: RunGoal; stageBefore: CharacterStage; totalKmBefore: number; wasFrozen: boolean};

type RunFlow =
  // 시간·거리·칼로리 목표는 값을 고르는 화면을 먼저 거친다
  | {phase: 'setup'; goalType: Exclude<RunGoalType, 'free'>}
  | ({phase: 'running'} & RunStart)
  | ({phase: 'saving'; result: RunResult} & RunStart)
  | {phase: 'complete'; before: RunStartSnapshot; run: RunDocument};

export function MainAppScreen({user, character, onHomeReady}: Props) {
  const [activeTab, setActiveTab] = useState<MainTab>('home');
  const [runFlow, setRunFlow] = useState<RunFlow | null>(null);
  const [runSheetOpen, setRunSheetOpen] = useState(false);
  const [parksOpen,setParksOpen]=useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [inventoryMode, setInventoryMode] = useState<'owned' | 'all' | null>(null);
  const [characterPreviewOpen, setCharacterPreviewOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [communityLink, setCommunityLink] = useState<CommunityLink | null>(null);
  // 알림에서 게시물·프로필로 올 때 이미 열려 있는 커뮤니티 화면도 새로 시작하게 하는 표시
  const [communityKey, setCommunityKey] = useState(0);
  const [communitySubpage, setCommunitySubpage] = useState(false);
  const [together, setTogether] = useState<{friendUid?: string} | null>(null);
  const [recordSubpage,setRecordSubpage]=useState(false);
  const hasUnread = useUnreadNotifications(user?.uid);
  const push = usePushNotifications(user?.uid, user?.notification_settings?.push ?? false, () => setNotificationsOpen(true));

  const recovery = useRunRecovery(user?.uid);
  // 위에 겹쳐 열려 있는 전체 화면(설정, 알림, 보관함 등). 열려 있는 동안 아래 탭 화면은 그대로 두고 눌리지 않게 한다
  const overlayOpen = (__DEV__ && characterPreviewOpen) || (settingsOpen && !!user) || (!!inventoryMode && !!character) || parksOpen || notificationsOpen || (!!together && !!user && !!character);
  // 탭 화면에서 가로로 쓸어 탭을 바꾼다(손가락을 따라 움직이고, 탭 바를 눌러도 같은 방식으로 움직인다).
  // 커뮤니티·기록의 하위 화면(게시물, 채팅, 기록 상세 등)이나 전체 화면이 열려 있을 때는 끈다
  const pager = useTabPager({
    active: activeTab,
    enabled: !overlayOpen && !(activeTab === 'community' && communitySubpage) && !(activeTab === 'records' && recordSubpage),
    onChange: setActiveTab,
  });
  const openRunSheet = () => setRunSheetOpen(true);

  // 알림을 누르면 알림 목록을 닫고 그 알림이 가리키는 곳으로 간다
  const openNotificationTarget = (target: NotificationTarget) => {
    setNotificationsOpen(false);
    if (target.kind === 'post') {
      setCommunityLink({page: 'post', id: target.postId});
      setCommunityKey(key => key + 1);
      setActiveTab('community');
    } else if (target.kind === 'profile') {
      setCommunityLink({page: 'profile', uid: target.uid});
      setCommunityKey(key => key + 1);
      setActiveTab('community');
    } else if (target.kind === 'together') setTogether({});
    else if (target.kind === 'growth') setActiveTab('growth');
    else if (target.kind === 'home') setActiveTab('home');
    else if (user) setSettingsOpen(true);
  };

  // 설정의 "저장한 게시물": 설정을 닫고 커뮤니티에서 저장한 게시물을 연다. 뒤로 가면 커뮤니티 피드로 돌아온다
  const openSavedPosts = () => {
    setSettingsOpen(false);
    setCommunityLink({page: 'saved'});
    setCommunityKey(key => key + 1);
    setActiveTab('community');
  };

  const selectGoal = (goalType: RunGoalType) => {
    setRunSheetOpen(false);
    if (goalType === 'free') {
      startRun({goalType, goalValue: null});
      return;
    }
    setRunFlow({phase: 'setup', goalType});
  };

  const startRun = (goal: RunGoal) => {
    if (!user || !character) {
      Alert.alert('잠시만요', '캐릭터 정보를 불러오는 중이에요. 잠시 후 다시 시도해 주세요.');
      return false;
    }
    const before = {stageBefore: character.stage, totalKmBefore: user.total_km, wasFrozen: user.is_frozen};
    const context: RunContext = {uid: user.uid, sessionKey: `${user.uid}_${Date.now()}`, goal, before, weightKg: user.weight_kg};
    setRunFlow({phase: 'running', context, goal, ...before});
    return true;
  };

  const saveRun = async (flow: Extract<RunFlow, {phase: 'running' | 'saving'}>, result: RunResult) => {
    setRunFlow({...flow, phase: 'saving', result});

    try {
      const id = await queueRun(flow.context, result);
      recovery.dismiss();
      const run = await uploadPendingRun(flow.context.uid, id);
      recovery.refresh();
      setRunFlow({
        phase: 'complete',
        before: {stageBefore: flow.stageBefore, totalKmBefore: flow.totalKmBefore, wasFrozen: flow.wasFrozen},
        run,
      });
    } catch {
      Alert.alert('저장을 완료하지 못했어요', '기기에 남아 있는 기록은 다시 열 때 복구하거나 자동으로 저장해요. 앱을 삭제하면 기기 기록이 사라질 수 있어요.', [
        {text: '홈으로', onPress: () => {setRunFlow(null); recovery.refresh();}},
        {text: '다시 시도', onPress: () => saveRun(flow, result)},
      ]);
    }
  };

  const closeRunFlow = (nextTab: MainTab) => {
    recovery.dismiss(); recovery.refresh();
    setRunFlow(null);
    setActiveTab(nextTab);
  };

  if (runFlow && character) {
    if (runFlow.phase === 'setup') {
      return (
        <GoalValueScreen
          goalType={runFlow.goalType}
          onBack={() => {
            setRunFlow(null);
            setRunSheetOpen(true);
          }}
          onStart={value => startRun({goalType: runFlow.goalType, goalValue: value})}
        />
      );
    }

    if (runFlow.phase === 'running') {
      return (
        <RunningScreen
          context={runFlow.context}
          restore={runFlow.restore}
          onProgress={runFlow.context.roomId ? (km, pace, paused) => {publishRoomProgress(runFlow.context.roomId!, km, pace, paused ? 'paused' : 'active').catch(() => {});} : undefined}
          goalType={runFlow.goal.goalType}
          goalValue={runFlow.goal.goalValue}
          contextLabel={runFlow.goal.parkName}
          characterType={character.character_type}
          characterStage={runFlow.stageBefore}
          equipped={character.equipped}
          weightKg={user?.weight_kg ?? null}
          onFinish={result => saveRun(runFlow, result)}
          onCancel={() => closeRunFlow('home')}
        />
      );
    }

    if (runFlow.phase === 'saving') {
      return (
        <View style={styles.savingScreen}>
          <ActivityIndicator color={colors.primary} size="large" />
          <AppText variant="subheading" color={colors.textMuted} style={styles.savingText}>
            기록 저장 중
          </AppText>
        </View>
      );
    }

    return <CompletedRunScreen run={runFlow.run} before={runFlow.before} character={character}
      onRecordBack={() => closeRunFlow('records')} onClose={() => closeRunFlow('home')} onPosted={() => closeRunFlow('community')}/>;
  }

  if (recovery.status !== 'ready') return <View style={styles.savingScreen}>
    {recovery.status === 'loading' ? <ActivityIndicator color={colors.primary}/> : <><AppText>기기에 보관한 달리기를 확인하지 못했어요.</AppText><Button label="복구 기록 다시 확인" onPress={recovery.refresh}/></>}
  </View>;
  if (recovery.active && character) {
    const session = recovery.active;
    const flow = {context: session.context, goal: session.context.goal, ...session.context.before};
    return <RunRecoveryScreen session={session} onResume={() => {setRunFlow({phase: 'running', ...flow, restore: session}); recovery.dismiss();}}
      onSave={finished => saveRun({phase: 'saving', ...flow, result: sessionResult(finished)}, sessionResult(finished))}
      onDiscard={() => {recovery.dismiss(); recovery.refresh();}}/>;
  }

  // 헤더의 설정 아이콘은 마이 화면을 거치지 않고 설정으로 바로 간다. 돌아오면 누르기 전 탭으로 돌아온다
  const header = {onNotificationPress: () => setNotificationsOpen(true), onSettingsPress: () => {if (user) setSettingsOpen(true);}, hasUnread};

  // 전체 화면은 오른쪽에서 밀려 들어와 탭 화면 위에 겹치고, 뒤로 가면 오른쪽으로 밀려 나간다
  let overlay: React.ReactNode = null;
  if (__DEV__ && characterPreviewOpen) overlay = <SlideScreen key="preview" onBack={() => setCharacterPreviewOpen(false)}>{back => <CharacterPreviewScreen onBack={back} />}</SlideScreen>;
  else if (blockedOpen) overlay = <SlideScreen key="blocked" onBack={() => setBlockedOpen(false)}>{back => <BlockedUsersScreen onBack={back} />}</SlideScreen>;
  else if (settingsOpen && user) overlay = <SlideScreen key="settings" onBack={() => setSettingsOpen(false)}>{back => <SettingsScreen user={user} onBack={back} onPreviewCharacter={() => setCharacterPreviewOpen(true)} onOpenSaved={openSavedPosts} onOpenBlocked={() => setBlockedOpen(true)} />}</SlideScreen>;
  else if (inventoryMode && character) overlay = <SlideScreen key="inventory" onBack={() => setInventoryMode(null)}>{back => <InventoryScreen key={character.uid} character={character} frozen={user?.is_frozen} initialMode={inventoryMode} onBack={back}/>}</SlideScreen>;
  else if (parksOpen) overlay = <SlideScreen key="parks" onBack={() => setParksOpen(false)}>{back => <ParksScreen onBack={back} onStart={(park,km,courseId)=>{
    if(startRun({goalType:'distance',goalValue:km,parkId:park.park_id,parkName:park.name,courseId}))setParksOpen(false);
  }}/>}</SlideScreen>;
  else if (notificationsOpen) overlay = <SlideScreen key="notifications" onBack={() => setNotificationsOpen(false)}>{back => <NotificationsScreen onBack={back} onNavigate={openNotificationTarget} />}</SlideScreen>;
  else if (together && user && character) overlay = <SlideScreen key="together" onBack={() => setTogether(null)}>{back => <TogetherScreen user={user} character={character} initialFriendUid={together.friendUid} onBack={back} onPosted={() => {setTogether(null); setActiveTab('community');}} />}</SlideScreen>;

  const renderTab = (tab: MainTab) => {
    if (tab === 'home') return <HomeScreen user={user} character={character} onItemsPress={() => setInventoryMode('owned')} onReady={onHomeReady} {...header} />;
    if (tab === 'growth') return <GrowthScreen user={user} character={character} {...header} />;
    if (tab === 'community') return <CommunityScreen key={communityKey} {...header} initialRoute={communityLink ?? undefined} onInitialRouteHandled={() => setCommunityLink(null)} onSubpageChange={setCommunitySubpage} onTogetherPress={friendUid => setTogether({friendUid})}/>;
    if (tab === 'records') return <RecordScreen {...header} character={character} onSubpageChange={setRecordSubpage} onPosted={() => setActiveTab('community')}/>;
    return null;
  };

  return (
    <View style={styles.screen}>
      <View style={styles.main} accessibilityElementsHidden={overlayOpen} importantForAccessibility={overlayOpen ? 'no-hide-descendants' : 'auto'}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        {recovery.pending > 0 && <View style={styles.pendingBanner}><AppText variant="caption">기기에 보관한 기록 {recovery.pending}개 · {recovery.syncing ? '저장 중' : '연결되면 자동 저장'}</AppText><Button label="다시 저장" size="md" variant="ghost" disabled={recovery.syncing} onPress={recovery.sync}/></View>}
        <TabPagerView pager={pager} renderTab={renderTab} />
        {!(activeTab === 'community' && communitySubpage) && !(activeTab === 'records' && recordSubpage) && <BottomTabBar activeTab={activeTab} onChange={tab => (tab === 'run' ? openRunSheet() : pager.goTo(tab))} />}
        <RunStartSheet visible={runSheetOpen} onClose={() => setRunSheetOpen(false)} onSelect={selectGoal} onParkPress={()=>{setRunSheetOpen(false);setParksOpen(true);}}/>
        {push.notice && <Pressable accessibilityRole="button" onPress={() => {push.dismiss(); setNotificationsOpen(true);}} style={styles.pushBanner}>
          <AppText variant="subheading">{push.notice.title}</AppText><AppText variant="caption">{push.notice.body}</AppText>
        </Pressable>}
      </View>
      {overlay}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: colors.background},
  main: {flex: 1},
  pendingBanner: {paddingTop: 40, paddingHorizontal: 20, backgroundColor: colors.primarySoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  savingScreen: {flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center'},
  savingText: {marginTop: 16},
  pushBanner: {position: 'absolute', top: 56, left: 20, right: 20, padding: 16, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.primary},
});
