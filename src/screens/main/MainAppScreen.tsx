import React, {useState} from 'react';
import {ActivityIndicator, Alert, Image, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {CommunityScreen} from '../community/CommunityScreen';
import {HomeScreen} from '../home/HomeScreen';
import {MyPageScreen} from '../profile/MyPageScreen';
import {GoalSetScreen} from '../run/GoalSetScreen';
import {RecordScreen} from '../run/RecordScreen';
import {RunCompleteScreen} from '../run/RunCompleteScreen';
import {RunningScreen} from '../run/RunningScreen';
import type {RunResult} from '../../hooks/useRunSession';
import {saveRunRecord} from '../../services/run.service';
import {colors} from '../../theme';
import type {CharacterDocument, CharacterStage} from '../../types/character.types';
import type {RunGoalType} from '../../types/run.types';
import type {UserDocument} from '../../types/user.types';
import {getCharacterStage} from '../../utils/exp';
import {calculateAveragePace} from '../../utils/pace';

const images = {
  avatar: require('../../assets/images/dalryo-avatar.png'),
};

type MainTab = 'home' | 'community' | 'run' | 'records' | 'my';

type Props = {
  user: UserDocument | null;
  character: CharacterDocument | null;
};

type RunGoal = {goalType: RunGoalType; goalValue: number | null};

// 달리기 중에는 바텀 탭을 숨기고 전체 화면으로 진행한다.
// 시작 시점의 단계·누적 거리를 들고 다녀야 서버 반영 전에도 부화/성장 여부를 판단할 수 있다
type RunFlow =
  | {phase: 'running'; goal: RunGoal; stageBefore: CharacterStage; totalKmBefore: number}
  | {phase: 'saving'; goal: RunGoal; stageBefore: CharacterStage; totalKmBefore: number; result: RunResult}
  | {phase: 'complete'; stageBefore: CharacterStage; stageAfter: CharacterStage; result: RunResult};

const MINT = colors.primary;

export function MainAppScreen({user, character}: Props) {
  const [activeTab, setActiveTab] = useState<MainTab>('home');
  const [runFlow, setRunFlow] = useState<RunFlow | null>(null);

  const openRunGoal = () => setActiveTab('run');

  const startRun = (goal: RunGoal) => {
    if (!user || !character) {
      Alert.alert('잠시만요', '캐릭터 정보를 불러오는 중이에요. 잠시 후 다시 시도해 주세요.');
      return;
    }
    setRunFlow({phase: 'running', goal, stageBefore: character.stage, totalKmBefore: user.total_km});
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
          <ActivityIndicator color={MINT} size="large" />
          <Text style={styles.savingText}>기록 저장 중...</Text>
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
        onViewRecord={() => closeRunFlow('records')}
        onClose={() => closeRunFlow('home')}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.body}>
        {activeTab === 'home' && <HomeScreen user={user} onRunPress={openRunGoal} onNotificationPress={() => undefined} />}
        {activeTab === 'community' && <CommunityScreen />}
        {activeTab === 'run' && (
          <GoalSetScreen onClose={() => setActiveTab('home')} onStart={(goalType, goalValue) => startRun({goalType, goalValue})} />
        )}
        {activeTab === 'records' && <RecordScreen />}
        {activeTab === 'my' && <MyPageScreen user={user} />}
      </View>
      <BottomNav activeTab={activeTab} onChange={setActiveTab} />
    </View>
  );
}

function BottomNav({activeTab, onChange}: {activeTab: MainTab; onChange: (tab: MainTab) => void}) {
  return (
    <View style={styles.bottomNav}>
      <NavItem active={activeTab === 'home'} icon="⌂" label="홈" onPress={() => onChange('home')} />
      <NavItem active={activeTab === 'community'} icon="▣" label="커뮤니티" onPress={() => onChange('community')} />
      <TouchableOpacity activeOpacity={0.86} onPress={() => onChange('run')} style={styles.navRunButton}>
        <Text style={styles.navRunIcon}>✧</Text>
      </TouchableOpacity>
      <NavItem active={activeTab === 'records'} icon="▦" label="기록" onPress={() => onChange('records')} />
      <NavItem active={activeTab === 'my'} icon="⌾" label="마이페이지" onPress={() => onChange('my')} />
    </View>
  );
}

function NavItem({active, icon, label, onPress}: {active: boolean; icon: string; label: string; onPress: () => void}) {
  return (
    <TouchableOpacity activeOpacity={0.78} onPress={onPress} style={styles.navItem}>
      <View style={[styles.navIconWrap, active && styles.navIconActive]}>
        {label === '마이페이지' ? (
          <Image source={images.avatar} resizeMode="contain" style={[styles.navAvatar, active && styles.navAvatarActive]} />
        ) : (
          <Text style={[styles.navIcon, active && styles.navIconTextActive]}>{icon}</Text>
        )}
      </View>
      <Text style={[styles.navLabel, active && styles.navLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#F6FEFF'},
  body: {flex: 1},
  savingScreen: {flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center'},
  savingText: {color: colors.text, fontSize: 17, fontWeight: '900', marginTop: 18},
  bottomNav: {position: 'absolute', left: 0, right: 0, bottom: 0, height: 96, backgroundColor: 'rgba(255,255,255,0.96)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingBottom: 14, borderTopWidth: 1, borderTopColor: 'rgba(199,224,215,0.55)'},
  navItem: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  navIconWrap: {width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center'},
  navIconActive: {backgroundColor: '#EFFFF8'},
  navIcon: {color: '#8E8E8E', fontSize: 25, fontWeight: '900'},
  navIconTextActive: {color: MINT},
  navAvatar: {width: 30, height: 30, opacity: 0.72},
  navAvatarActive: {opacity: 1},
  navLabel: {color: '#878787', fontSize: 11, fontWeight: '900', marginTop: 2},
  navLabelActive: {color: '#2BAF85'},
  navRunButton: {width: 74, height: 74, borderRadius: 37, backgroundColor: '#E7FFF7', borderWidth: 3, borderColor: '#A7E6CF', alignItems: 'center', justifyContent: 'center', marginTop: -34, shadowColor: '#9ADCC6', shadowOpacity: 0.28, shadowRadius: 14, shadowOffset: {width: 0, height: 7}, elevation: 8},
  navRunIcon: {color: MINT, fontSize: 36, fontWeight: '900'},
});
