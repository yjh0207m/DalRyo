import React, {useState} from 'react';
import {ActivityIndicator, Alert, Pressable, StatusBar, StyleSheet, View} from 'react-native';
import {CommunityScreen} from '../community/CommunityScreen';
import {TogetherScreen} from '../together/TogetherScreen';
import {GrowthScreen} from '../growth/GrowthScreen';
import {HomeScreen} from '../home/HomeScreen';
import {MyPageScreen} from '../profile/MyPageScreen';
import {CharacterPreviewScreen} from '../dev/CharacterPreviewScreen';
import {SettingsScreen} from '../profile/SettingsScreen';
import {NotificationsScreen} from '../profile/NotificationsScreen';
import {useUnreadNotifications} from '../../hooks/useNotifications';
import {usePushNotifications} from '../../hooks/usePushNotifications';
import {GoalValueScreen} from '../run/GoalValueScreen';
import {RecordScreen} from '../run/RecordScreen';
import {RunCompleteScreen} from '../run/RunCompleteScreen';
import {RunningScreen} from '../run/RunningScreen';
import {RunStartSheet} from '../run/RunStartSheet';
import type {RunResult} from '../../hooks/useRunSession';
import {AppText} from '../../components/ui';
import {BottomTabBar, type MainTab} from '../../navigation/BottomTabBar';
import {saveRunRecord} from '../../services/run.service';
import {colors} from '../../theme';
import type {CharacterDocument, CharacterStage} from '../../types/character.types';
import type {RunGoalType} from '../../types/run.types';
import type {UserDocument} from '../../types/user.types';
import {getCharacterStage} from '../../utils/exp';
import {calculateAveragePace} from '../../utils/pace';

type Props = {
  user: UserDocument | null;
  character: CharacterDocument | null;
};

type RunGoal = {goalType: RunGoalType; goalValue: number | null};

// 달리기 중에는 바텀 탭을 숨기고 전체 화면으로 진행한다.
// 시작 시점의 단계·누적 거리를 들고 다녀야 서버 반영 전에도 부화/성장 여부를 판단할 수 있다
type RunStart = {goal: RunGoal; stageBefore: CharacterStage; totalKmBefore: number; wasFrozen: boolean};

type RunFlow =
  // 시간·거리·칼로리 목표는 값을 고르는 화면을 먼저 거친다
  | {phase: 'setup'; goalType: Exclude<RunGoalType, 'free'>}
  | ({phase: 'running'} & RunStart)
  | ({phase: 'saving'; result: RunResult} & RunStart)
  | {phase: 'complete'; stageBefore: CharacterStage; stageAfter: CharacterStage; wasFrozen: boolean; result: RunResult};

export function MainAppScreen({user, character}: Props) {
  const [activeTab, setActiveTab] = useState<MainTab>('home');
  const [runFlow, setRunFlow] = useState<RunFlow | null>(null);
  const [runSheetOpen, setRunSheetOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [characterPreviewOpen, setCharacterPreviewOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [communitySubpage, setCommunitySubpage] = useState(false);
  const [together, setTogether] = useState<{friendUid?: string} | null>(null);
  const [recordSubpage,setRecordSubpage]=useState(false);
  const hasUnread = useUnreadNotifications(user?.uid);
  const push = usePushNotifications(user?.uid, user?.notification_settings?.push ?? false, () => setNotificationsOpen(true));

  const openRunSheet = () => setRunSheetOpen(true);

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
      return;
    }
    setRunFlow({phase: 'running', goal, stageBefore: character.stage, totalKmBefore: user.total_km, wasFrozen: user.is_frozen});
  };

  const saveRun = async (flow: Extract<RunFlow, {phase: 'running' | 'saving'}>, result: RunResult) => {
    setRunFlow({...flow, phase: 'saving', result});

    try {
      await saveRunRecord({
        goalType: flow.goal.goalType,
        goalValue: flow.goal.goalValue,
        startedAt: result.startedAt,
        durationSec: result.durationSec,
        distanceKm: result.distanceKm,
        avgSpeedKmh: result.avgSpeedKmh,
        calories: result.calories,
        route: result.route,
      });
      setRunFlow({
        phase: 'complete',
        stageBefore: flow.stageBefore,
        stageAfter: getCharacterStage(flow.totalKmBefore + result.distanceKm),
        wasFrozen: flow.wasFrozen,
        result,
      });
    } catch {
      Alert.alert('기록 저장에 실패했어요', '네트워크를 확인하고 다시 시도해 주세요.', [
        {text: '버리기', style: 'destructive', onPress: () => setRunFlow(null)},
        {text: '다시 시도', onPress: () => saveRun(flow, result)},
      ]);
    }
  };

  const closeRunFlow = (nextTab: MainTab) => {
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
          goalType={runFlow.goal.goalType}
          goalValue={runFlow.goal.goalValue}
          characterType={character.character_type}
          characterStage={runFlow.stageBefore}
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

    return (
      <RunCompleteScreen
        distanceKm={runFlow.result.distanceKm}
        durationSec={runFlow.result.durationSec}
        avgPaceSec={calculateAveragePace(runFlow.result.durationSec, runFlow.result.distanceKm)}
        calories={runFlow.result.calories}
        characterType={character.character_type}
        petName={character.pet_name}
        stageBeforeRun={runFlow.stageBefore}
        stageAfterRun={runFlow.stageAfter}
        wasFrozen={runFlow.wasFrozen}
        onViewRecord={() => closeRunFlow('records')}
        onClose={() => closeRunFlow('home')}
      />
    );
  }

  if (__DEV__ && characterPreviewOpen) return <CharacterPreviewScreen onBack={() => setCharacterPreviewOpen(false)} />;
  if (settingsOpen && user) return <SettingsScreen user={user} onBack={() => setSettingsOpen(false)} />;
  if (notificationsOpen)
    return (
      <NotificationsScreen
        onBack={() => setNotificationsOpen(false)}
        onOpenTogether={() => {
          setNotificationsOpen(false);
          setTogether({});
        }}
      />
    );
  if (together && user && character)
    return <TogetherScreen user={user} character={character} initialFriendUid={together.friendUid} onBack={() => setTogether(null)} />;

  const header = {onNotificationPress: () => setNotificationsOpen(true), onSettingsPress: () => setActiveTab('my'), hasUnread};

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={styles.body}>
        {activeTab === 'home' && <HomeScreen user={user} character={character} onRunPress={openRunSheet} {...header} />}
        {activeTab === 'growth' && <GrowthScreen user={user} character={character} {...header} />}
        {activeTab === 'community' && <CommunityScreen {...header} onSubpageChange={setCommunitySubpage} onTogetherPress={friendUid => setTogether({friendUid})}/>}
        {activeTab === 'records' && <RecordScreen {...header} character={character} onSubpageChange={setRecordSubpage}/>}
        {activeTab === 'my' && <MyPageScreen user={user} character={character} onBack={() => setActiveTab('home')} onOpenSettings={() => setSettingsOpen(true)} onPreviewCharacter={() => setCharacterPreviewOpen(true)} />}
      </View>
      {!(activeTab === 'community' && communitySubpage) && !(activeTab === 'records' && recordSubpage) && <BottomTabBar activeTab={activeTab} onChange={tab => (tab === 'run' ? openRunSheet() : setActiveTab(tab))} />}
      <RunStartSheet visible={runSheetOpen} onClose={() => setRunSheetOpen(false)} onSelect={selectGoal} />
      {push.notice && <Pressable accessibilityRole="button" onPress={() => {push.dismiss(); setNotificationsOpen(true);}} style={styles.pushBanner}>
        <AppText variant="subheading">{push.notice.title}</AppText><AppText variant="caption">{push.notice.body}</AppText>
      </Pressable>}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: colors.background},
  body: {flex: 1},
  savingScreen: {flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center'},
  savingText: {marginTop: 16},
  pushBanner: {position: 'absolute', top: 56, left: 20, right: 20, padding: 16, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.primary},
});
