import React, {useEffect, useState} from 'react';
import {Alert, StatusBar, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {CharacterView} from '../../components/character/CharacterView';
import {useRunSession, type RunResult} from '../../hooks/useRunSession';
import {colors, radius, shadow, spacing, typography} from '../../theme';
import type {CharacterStage, CharacterType} from '../../types/character.types';
import type {RunGoalType} from '../../types/run.types';
import {getMotion} from '../../utils/motion';
import {calculateAveragePace, formatClock, formatPace} from '../../utils/pace';

type Props = {
  goalType: RunGoalType;
  goalValue: number | null;
  characterType: CharacterType;
  characterStage: CharacterStage;
  weightKg: number | null;
  onFinish: (result: RunResult) => void;
  onCancel: () => void;
};

const COUNTDOWN_FROM = 3;

export function RunningScreen({goalType, goalValue, characterType, characterStage, weightKg, onFinish, onCancel}: Props) {
  const session = useRunSession({weightKg});
  const [countdown, setCountdown] = useState(COUNTDOWN_FROM);
  const {begin} = session;

  useEffect(() => {
    if (countdown <= 0) {
      begin();
      return undefined;
    }

    const timer = setTimeout(() => setCountdown(value => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, begin]);

  const paceSec = calculateAveragePace(session.elapsedSec, session.distanceKm);
  const progress = getGoalProgress(goalType, goalValue, session);
  const motion = session.phase === 'running' ? getMotion(session.speedKmh) : 'rest';

  const confirmCancel = () => {
    Alert.alert('달리기를 그만둘까요?', '지금까지 기록은 저장되지 않아요.', [
      {text: '계속 달리기', style: 'cancel'},
      {text: '나가기', style: 'destructive', onPress: onCancel},
    ]);
  };

  const finish = () => onFinish(session.finish());

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={styles.header}>
        <Text style={styles.goalLabel}>{getGoalLabel(goalType, goalValue)}</Text>
        <TouchableOpacity activeOpacity={0.75} onPress={confirmCancel} style={styles.closeButton} accessibilityLabel="달리기 그만두기">
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.clock}>{formatClock(session.elapsedSec)}</Text>

      <View style={styles.statsRow}>
        <Stat label="거리(km)" value={session.distanceKm.toFixed(2)} />
        <Stat label="페이스" value={paceSec > 0 ? formatPace(paceSec) : `-'--"`} />
        <Stat label="칼로리" value={String(session.calories)} />
      </View>

      {progress !== null && (
        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, {width: `${Math.min(100, progress * 100)}%`}]} />
          </View>
          <Text style={styles.progressText}>{progress >= 1 ? '목표 달성! 더 달려도 좋아요' : `${Math.floor(progress * 100)}%`}</Text>
        </View>
      )}

      {/* TODO(F-RUN-02): react-native-maps 연결 후 경로 Polyline + 캐릭터 마커로 교체 */}
      <View style={styles.characterStage}>
        <CharacterView type={characterType} stage={characterStage} motion={motion} size={220} />
      </View>

      {(session.gpsStatus === 'denied' || session.gpsStatus === 'error') && (
        <Text style={styles.gpsWarning}>
          {session.gpsStatus === 'denied' ? '위치 권한이 없어서 거리를 잴 수 없어요.' : 'GPS 신호를 찾고 있어요...'}
        </Text>
      )}

      <View style={styles.controls}>
        {session.phase === 'paused' ? (
          <>
            <TouchableOpacity activeOpacity={0.86} onPress={finish} style={[styles.controlButton, styles.finishButton]}>
              <Text style={[styles.controlText, styles.finishText]}>종료</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.86} onPress={session.resume} style={[styles.controlButton, styles.primaryButton]}>
              <Text style={styles.controlText}>달료!</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            activeOpacity={0.86}
            disabled={session.phase !== 'running'}
            onPress={session.pause}
            style={[styles.controlButton, styles.primaryButton, styles.controlWide]}>
            <Text style={styles.controlText}>멈쵸!</Text>
          </TouchableOpacity>
        )}
      </View>

      {countdown > 0 && (
        <View style={styles.countdownOverlay}>
          <Text style={styles.countdownText}>{countdown}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

function Stat({label, value}: {label: string; value: string}) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function getGoalLabel(goalType: RunGoalType, goalValue: number | null) {
  if (goalType === 'time') return `${goalValue}분 달리기`;
  if (goalType === 'distance') return `${goalValue}km 달리기`;
  if (goalType === 'calorie') return `${goalValue}kcal 태우기`;
  return '자유 달리기';
}

function getGoalProgress(
  goalType: RunGoalType,
  goalValue: number | null,
  {elapsedSec, distanceKm, calories}: {elapsedSec: number; distanceKm: number; calories: number},
) {
  if (!goalValue || goalType === 'free') return null;
  if (goalType === 'time') return elapsedSec / (goalValue * 60);
  if (goalType === 'distance') return distanceKm / goalValue;
  return calories / goalValue;
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.xl},
  header: {height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  goalLabel: {...typography.heading, color: colors.text},
  closeButton: {width: 44, height: 44, alignItems: 'center', justifyContent: 'center'},
  closeText: {color: colors.text, fontSize: 22, fontWeight: '700'},
  clock: {...typography.display, color: colors.text, textAlign: 'center', fontVariant: ['tabular-nums'], marginTop: spacing.sm},
  statsRow: {flexDirection: 'row', marginTop: spacing.lg},
  stat: {flex: 1, alignItems: 'center'},
  statValue: {color: colors.text, fontSize: 24, fontWeight: '900', fontVariant: ['tabular-nums']},
  statLabel: {...typography.caption, color: colors.textMuted, marginTop: spacing.xs},
  progressWrap: {marginTop: spacing.xl},
  progressTrack: {height: 8, borderRadius: radius.pill, backgroundColor: colors.border, overflow: 'hidden'},
  progressFill: {height: '100%', borderRadius: radius.pill, backgroundColor: colors.primary},
  progressText: {...typography.caption, color: colors.primaryStrong, textAlign: 'right', marginTop: spacing.xs},
  characterStage: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  gpsWarning: {...typography.caption, color: colors.danger, textAlign: 'center', marginBottom: spacing.md},
  controls: {flexDirection: 'row', gap: spacing.md, paddingBottom: spacing.xl},
  controlButton: {flex: 1, height: 64, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center'},
  controlWide: {flex: 1},
  primaryButton: {backgroundColor: colors.primary, ...shadow.button},
  finishButton: {backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border},
  controlText: {color: colors.textOnPrimary, fontSize: 22, fontWeight: '900'},
  finishText: {color: colors.text},
  countdownOverlay: {...StyleSheet.absoluteFill, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center'},
  countdownText: {color: colors.textOnPrimary, fontSize: 120, fontWeight: '900'},
});
