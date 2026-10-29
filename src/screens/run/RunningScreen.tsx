import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useDialect } from '../../locales/DialectProvider';
import {
  Alert,
  BackHandler,
  Pressable,
  StatusBar,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapPinOff, Pause, Play, Square, Timer, X } from 'lucide-react-native';
import { CharacterView } from '../../components/character/CharacterView';
import { SpeechBubble } from '../../components/character/SpeechBubble';
import { RunningWorld } from '../../components/scene/RunningWorld';
import {
  AppText,
  Badge,
  Button,
  Card,
  IconButton,
  ProgressBar,
} from '../../components/ui';
import { useRunSession, type RunResult } from '../../hooks/useRunSession';
import { colors, fonts, typography } from '../../theme';
import type {
  CharacterStage,
  CharacterType,
  EquippedOutfit,
} from '../../types/character.types';
import type { RunGoalType } from '../../types/run.types';
import { getMotion } from '../../utils/motion';
import {
  calculateAveragePace,
  formatDuration,
  formatPace,
} from '../../utils/pace';
import type { RunContext, RunSessionSnapshot } from '../../types/runSession';

type Props = {
  goalType: RunGoalType;
  goalValue: number | null;
  characterType: CharacterType;
  characterStage: CharacterStage;
  equipped?: EquippedOutfit;
  weightKg: number | null;
  context: RunContext;
  restore?: RunSessionSnapshot;
  onFinish: (result: RunResult) => void;
  onCancel: () => void;
  onProgress?: (km: number, pace: number, paused: boolean) => void;
  livePanel?: React.ReactNode;
  cancelMessage?: string;
  contextLabel?: string;
};

const COUNTDOWN_FROM = 3;
const CHARACTER_SIZE = 160;

export function RunningScreen({
  goalType,
  goalValue,
  characterType,
  characterStage,
  context,
  restore,
  onFinish,
  onCancel,
  onProgress,
  livePanel,
  cancelMessage,
  contextLabel,
  equipped,
}: Props) {
  const insets = useSafeAreaInsets();
  const t = useDialect();
  const compact = useWindowDimensions().height < 740;
  const session = useRunSession({ context, restore });
  const [countdown, setCountdown] = useState(restore ? 0 : COUNTDOWN_FROM);
  const [worldHeight, setWorldHeight] = useState(0);
  const { begin } = session;

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
  const cheer = useCheer(
    Math.floor(session.distanceKm),
    progress !== null && progress >= 1,
    t,
  );
  const motion =
    session.phase === 'running' ? getMotion(session.speedKmh) : 'rest';
  const paused = session.phase === 'paused';
  const latestProgress = useRef({
    onProgress,
    km: session.distanceKm,
    pace: paceSec,
    paused,
    phase: session.phase,
  });
  latestProgress.current = {
    onProgress,
    km: session.distanceKm,
    pace: paceSec,
    paused,
    phase: session.phase,
  };
  const hasProgress = !!onProgress;
  useEffect(() => {
    if (!hasProgress) return;
    const timer = setInterval(() => {
      const p = latestProgress.current;
      if (p.phase === 'running' || p.phase === 'paused')
        p.onProgress?.(p.km, p.pace, p.paused);
    }, 5000);
    return () => clearInterval(timer);
  }, [hasProgress]);

  const confirmCancel = useCallback(() => {
    if (session.busy) return;
    Alert.alert(
      '달리기를 그만둘까요?',
      cancelMessage ?? '지금까지 기록은 저장되지 않아요.',
      [
        { text: '계속 달리기', style: 'cancel' },
        {
          text: '나가기',
          style: 'destructive',
          onPress: async () => {
            if (await session.cancel()) onCancel();
          },
        },
      ],
    );
  }, [cancelMessage, onCancel, session]);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      confirmCancel();
      return true;
    });
    return () => sub.remove();
  }, [confirmCancel]);

  const finish = async () => {
    const result = await session.finish();
    if (result) onFinish(result);
  };

  const characterSize = Math.min(
    CHARACTER_SIZE,
    Math.max(72, worldHeight * 0.8),
  );
  const statusText = paused
    ? '일시정지'
    : session.phase === 'ready'
    ? '시작 준비'
    : '기록 중';
  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <StatusBar
        barStyle={countdown > 0 ? 'light-content' : 'dark-content'}
        backgroundColor={countdown > 0 ? colors.primary : colors.sky}
      />
      <View style={styles.header}>
        <View style={styles.statusLabel}>
          <View style={[styles.statusDot, paused && styles.pausedDot]} />
          <AppText
            variant="label"
            color={paused ? colors.accentInk : colors.primaryInk}
          >
            {statusText}
          </AppText>
        </View>
        <Badge
          label={getGoalLabel(goalType, goalValue)}
          tone={paused ? 'warm' : 'brand'}
        />
        <IconButton
          icon={X}
          variant="plain"
          accessibilityLabel="달리기 그만두기"
          disabled={session.busy}
          onPress={confirmCancel}
        />
      </View>
      <Card style={[styles.stats, compact && styles.compactStats]}>
        <View style={styles.cardHeading}>
          <AppText style={styles.eyebrow} color={colors.textMuted}>
            DISTANCE
          </AppText>
          <AppText
            variant="label"
            color={colors.primaryInk}
            numberOfLines={1}
            style={styles.contextTitle}
          >
            {contextLabel ??
              (paused ? '잠깐 쉬어 가도 괜찮아요' : '나의 속도로 달리는 중')}
          </AppText>
        </View>
        <View style={styles.heroValue}>
          <AppText
            style={[styles.heroNumber, compact && styles.compactNumber]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {session.distanceKm.toFixed(2)}
          </AppText>
          <AppText style={styles.km} color={colors.primaryInk}>
            km
          </AppText>
        </View>
        <View style={styles.statRow}>
          <Stat
            label="시간"
            value={formatDuration(session.elapsedSec)}
            unit="분:초"
          />
          <View style={styles.divider} />
          <Stat
            label="평균 페이스"
            value={paceSec > 0 ? formatPace(paceSec) : `—`}
            unit="/km"
          />
          <View style={styles.divider} />
          <Stat label="칼로리" value={String(session.calories)} unit="kcal" />
        </View>
        {progress !== null && (
          <View style={styles.progress}>
            <View style={styles.cardHeading}>
              <AppText variant="caption" color={colors.textMuted}>
                {progress >= 1
                  ? '목표 달성! 더 달려도 좋아요'
                  : '목표까지 한 걸음씩'}
              </AppText>
              <AppText variant="label" color={colors.primaryInk}>
                {Math.min(100, Math.floor(progress * 100))}%
              </AppText>
            </View>
            <ProgressBar value={progress} height={5} />
          </View>
        )}
      </Card>
      {livePanel}
      {!!session.error && (
        <View style={styles.sessionError}>
          <AppText color={colors.danger} accessibilityRole="alert">
            {session.error}
          </AppText>
          {session.phase === 'ready' && (
            <Pressable accessibilityRole="button" onPress={session.begin}>
              <AppText color={colors.primaryInk}>다시 시작</AppText>
            </Pressable>
          )}
        </View>
      )}
      <View
        style={styles.ground}
        onLayout={event => setWorldHeight(event.nativeEvent.layout.height)}
      >
        {worldHeight > 0 && (
          <RunningWorld
            speedKmh={session.phase === 'running' ? session.speedKmh : 0}
            height={worldHeight}
            groundTop={0.73}
            cloudsTop={0.08}
            style={StyleSheet.absoluteFill}
          >
            <View
              style={[
                styles.character,
                {
                  width: characterSize,
                  height: characterSize,
                  marginTop: -characterSize * 0.82,
                },
              ]}
            >
              <CharacterView
                type={characterType}
                stage={characterStage}
                motion={motion}
                equipped={equipped}
                size={characterSize}
                dust={session.phase === 'running'}
              />
              {cheer && (
                <SpeechBubble
                  text={cheer}
                  style={{ bottom: characterSize * 0.98 }}
                />
              )}
            </View>
          </RunningWorld>
        )}
        {worldHeight >= 190 && (
          <View pointerEvents="none" style={styles.sceneCaption}>
            <FootstepLabel paused={paused} />
          </View>
        )}
      </View>
      <View style={[styles.controlDock, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.dockStatus}>
          {session.gpsStatus === 'denied' || session.gpsStatus === 'error' ? (
            <>
              <MapPinOff size={14} color={colors.danger} />
              <AppText variant="caption" color={colors.danger}>
                {session.gpsStatus === 'denied'
                  ? '위치 권한을 확인해 주세요'
                  : 'GPS 신호를 확인하고 있어요'}
              </AppText>
            </>
          ) : (
            <>
              <Timer size={14} color={colors.textMuted} />
              <AppText variant="caption" color={colors.textMuted}>
                {paused
                  ? '준비되면 다시 이어 달려요'
                  : '화면을 꺼도 달리기는 계속 기록돼요'}
              </AppText>
            </>
          )}
        </View>
        <View style={styles.controls}>
          {paused ? (
            <>
              <Button
                icon={Square}
                label="종료"
                variant="secondary"
                disabled={session.busy}
                onPress={finish}
                style={styles.control}
              />
              <Button
                icon={Play}
                label="계속 달리기"
                disabled={session.busy}
                onPress={session.resume}
                style={styles.control}
              />
            </>
          ) : (
            <Button
              icon={Pause}
              label={session.phase === 'ready' ? '달리기 준비 중' : '일시정지'}
              disabled={session.phase !== 'running' || session.busy}
              onPress={session.pause}
              style={styles.control}
            />
          )}
        </View>
      </View>
      {countdown > 0 && (
        <View style={styles.countdownOverlay}>
          <AppText style={styles.countdownText} color={colors.textOnPrimary}>
            {countdown}
          </AppText>
          <AppText variant="subheading" color={colors.textOnPrimary}>
            {t('run.countdown')}
          </AppText>
        </View>
      )}
    </View>
  );
}
function FootstepLabel({ paused }: { paused: boolean }) {
  return (
    <AppText style={styles.sceneLabel} color={colors.primaryInk}>
      {paused ? 'TAKE A BREATH' : 'ONE STEP AT A TIME'}
    </AppText>
  );
}

// 1km를 넘길 때마다, 그리고 목표를 처음 달성했을 때 캐릭터가 잠깐 응원한다
const CHEER_MS = 3500;
function useCheer(
  km: number,
  goalReached: boolean,
  t: ReturnType<typeof useDialect>,
) {
  const [cheer, setCheer] = useState<string | null>(null);
  const goalShown = useRef(false);

  useEffect(() => {
    if (km > 0) setCheer(t('run.cheerKm', { km }));
  }, [km, t]);

  useEffect(() => {
    if (goalReached && !goalShown.current) {
      goalShown.current = true;
      setCheer(t('run.cheerGoal'));
    }
  }, [goalReached, t]);

  useEffect(() => {
    if (!cheer) return undefined;
    const timer = setTimeout(() => setCheer(null), CHEER_MS);
    return () => clearTimeout(timer);
  }, [cheer]);

  return cheer;
}

function Stat({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <View style={styles.stat}>
      <AppText variant="label" color={colors.textMuted}>
        {label}
      </AppText>
      <AppText style={styles.statNumber} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </AppText>
      <AppText style={styles.statUnit} color={colors.textMuted}>
        {unit}
      </AppText>
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
  {
    elapsedSec,
    distanceKm,
    calories,
  }: { elapsedSec: number; distanceKm: number; calories: number },
) {
  if (!goalValue || goalType === 'free') return null;
  if (goalType === 'time') return elapsedSec / (goalValue * 60);
  if (goalType === 'distance') return distanceKm / goalValue;
  return calories / goalValue;
}

const styles = StyleSheet.create({
  contextTitle: { flex: 1, textAlign: 'right' },
  screen: { flex: 1, backgroundColor: colors.sky },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    minHeight: 50,
  },
  statusLabel: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  pausedDot: { backgroundColor: colors.accent },
  stats: {
    marginHorizontal: 20,
    marginTop: 12,
    padding: 22,
    borderWidth: 0,
    borderRadius: 28,
  },
  compactStats: { padding: 18, marginTop: 6 },
  cardHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  eyebrow: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 1.8,
  },
  heroValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    justifyContent: 'center',
    marginVertical: 12,
  },
  heroNumber: {
    fontFamily: fonts.extrabold,
    fontSize: 80,
    lineHeight: 92,
    letterSpacing: -3,
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
  },
  compactNumber: { fontSize: 66, lineHeight: 78 },
  km: { fontFamily: fonts.medium, fontSize: 22, lineHeight: 30 },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  stat: { flex: 1, alignItems: 'center', gap: 5 },
  statNumber: {
    fontFamily: fonts.bold,
    fontSize: 23,
    lineHeight: 30,
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'],
    maxWidth: '100%',
  },
  statUnit: { fontSize: 10, lineHeight: 14 },
  divider: {
    height: 36,
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  progress: { marginTop: 18, gap: 9 },
  ground: { flex: 1, minHeight: 0 },
  character: {
    width: CHARACTER_SIZE,
    height: CHARACTER_SIZE,
    marginTop: -CHARACTER_SIZE * 0.82,
  },
  cheer: { bottom: CHARACTER_SIZE * 0.98 },
  sceneCaption: {
    position: 'absolute',
    top: 14,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  sceneLabel: {
    fontFamily: fonts.semibold,
    fontSize: 9,
    lineHeight: 14,
    letterSpacing: 2.2,
  },
  controlDock: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 14,
  },
  dockStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 12,
  },
  controls: { flexDirection: 'row', gap: 12 },
  control: { flex: 1 },
  sessionError: { paddingHorizontal: 20, paddingTop: 10 },
  countdownOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  countdownText: { ...typography.display, fontSize: 160, lineHeight: 176 },
});
