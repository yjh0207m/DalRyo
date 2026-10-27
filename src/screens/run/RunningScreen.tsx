import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useDialect} from '../../locales/DialectProvider';
import {Alert, BackHandler, Pressable, StatusBar, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {MapPinOff, Pause, Play, Square, X, type LucideIcon} from 'lucide-react-native';
import {CharacterView} from '../../components/character/CharacterView';
import {RunningWorld} from '../../components/scene/RunningWorld';
import {AppText, Badge, Card, IconButton, ProgressBar} from '../../components/ui';
import {useRunSession, type RunResult} from '../../hooks/useRunSession';
import {colors, shadow, spacing, typography} from '../../theme';
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
  onProgress?: (km:number,pace:number,paused:boolean)=>void;
  livePanel?: React.ReactNode;
  cancelMessage?: string;
};

const COUNTDOWN_FROM = 3;
const CHARACTER_SIZE = 180;
// 땅 아래쪽에 조작 버튼(원형 버튼 + 이름)이 들어갈 높이
const CONTROLS_AREA = 170;

export function RunningScreen({goalType, goalValue, characterType, characterStage, weightKg, onFinish, onCancel,onProgress,livePanel,cancelMessage}: Props) {
  const insets = useSafeAreaInsets();
  const t = useDialect();
  const session = useRunSession({weightKg});
  const [countdown, setCountdown] = useState(COUNTDOWN_FROM);
  const [worldHeight, setWorldHeight] = useState(0);
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
  const paused = session.phase === 'paused';
  const latestProgress=useRef({onProgress,km:session.distanceKm,pace:paceSec,paused,phase:session.phase});
  latestProgress.current={onProgress,km:session.distanceKm,pace:paceSec,paused,phase:session.phase};
  const hasProgress=!!onProgress;
  useEffect(()=>{
    if(!hasProgress)return;
    const timer=setInterval(()=>{const p=latestProgress.current;if(p.phase==='running'||p.phase==='paused')p.onProgress?.(p.km,p.pace,p.paused);},5000);
    return ()=>clearInterval(timer);
  },[hasProgress]);

  const confirmCancel = useCallback(() => {
    Alert.alert('달리기를 그만둘까요?', cancelMessage ?? '지금까지 기록은 저장되지 않아요.', [
      {text: '계속 달리기', style: 'cancel'},
      {text: '나가기', style: 'destructive', onPress: onCancel},
    ]);
  },[cancelMessage,onCancel]);
  useEffect(()=>{const sub=BackHandler.addEventListener('hardwareBackPress',()=>{confirmCancel();return true;});return ()=>sub.remove();},[confirmCancel]);

  const finish = () => onFinish(session.finish());

  return (
    <View style={[styles.screen, {paddingTop: insets.top + spacing.sm}]}>
      <StatusBar
        barStyle={countdown > 0 ? 'light-content' : 'dark-content'}
        backgroundColor={countdown > 0 ? colors.primary : colors.background}
      />
      <View style={styles.header}>
        <Badge label={getGoalLabel(goalType, goalValue)} tone={paused ? 'warm' : 'brand'} />
        <IconButton icon={X} variant="plain" accessibilityLabel="달리기 그만두기" onPress={confirmCancel} />
      </View>

      <View style={styles.clockBlock}>
        <AppText variant="label" color={paused ? colors.accentInk : colors.textMuted} align="center">
          {paused ? '일시정지' : '달리는 중'}
        </AppText>
        <AppText style={styles.clock} color={paused ? colors.text : colors.primaryInk} align="center">
          {formatClock(session.elapsedSec)}
        </AppText>
      </View>

      <Card style={styles.stats}>
        <Stat label="거리" value={session.distanceKm.toFixed(2)} unit="km" />
        <View style={styles.divider} />
        <Stat label="페이스" value={paceSec > 0 ? formatPace(paceSec) : `-'--"`} unit="/km" />
        <View style={styles.divider} />
        <Stat label="칼로리" value={String(session.calories)} unit="kcal" />
      </Card>
      {livePanel}

      {progress !== null && (
        <View style={styles.progress}>
          <ProgressBar value={progress} />
          <AppText variant="caption" color={progress >= 1 ? colors.primaryInk : colors.textMuted} align="right">
            {progress >= 1 ? '목표 달성! 더 달려도 좋아요' : `목표의 ${Math.floor(progress * 100)}%`}
          </AppText>
        </View>
      )}

      {/* TODO(F-RUN-02): react-native-maps 연결 후 경로 Polyline + 캐릭터 마커로 교체 */}
      <View style={styles.ground} onLayout={event => setWorldHeight(event.nativeEvent.layout.height)}>
        {/* 횡스크롤 월드: 실제 속도만큼 땅·언덕·구름이 흘러가고 캐릭터는 제자리에서 달린다. 조작 버튼은 땅 위에 띄운다 */}
        {worldHeight > 0 && (
          <RunningWorld
            speedKmh={session.phase === 'running' ? session.speedKmh : 0}
            height={worldHeight}
            groundTop={Math.max(0.4, 1 - (CONTROLS_AREA + insets.bottom) / worldHeight)}
            style={StyleSheet.absoluteFill}
          >
            <CharacterView
              type={characterType}
              stage={characterStage}
              motion={motion}
              size={CHARACTER_SIZE}
              dust={session.phase === 'running'}
              style={styles.character}
            />
          </RunningWorld>
        )}
        {(session.gpsStatus === 'denied' || session.gpsStatus === 'error') && (
          <View style={styles.gpsWarning}>
            <MapPinOff color={colors.danger} size={18} />
            <AppText variant="caption" color={colors.danger}>
              {session.gpsStatus === 'denied' ? '위치 권한이 없어서 거리를 잴 수 없어요' : 'GPS 신호를 찾고 있어요'}
            </AppText>
          </View>
        )}
        <View style={[styles.controls, {bottom: insets.bottom + spacing.xl}]}>
          {paused ? (
            <>
              <RoundControl icon={Square} label="종료" tone="dark" onPress={finish} />
              <RoundControl icon={Play} label={t('run.start')} tone="primary" onPress={session.resume} />
            </>
          ) : (
            <RoundControl
              icon={Pause}
              label={t('run.stop')}
              tone="primary"
              large
              disabled={session.phase !== 'running'}
              onPress={session.pause}
            />
          )}
        </View>
      </View>

      {countdown > 0 && (
        <View style={styles.countdownOverlay}>
          <AppText style={styles.countdownText} color={colors.textOnPrimary} align="center">
            {countdown}
          </AppText>
          <AppText variant="subheading" color={colors.textOnPrimary} align="center">
            {t('run.countdown')}
          </AppText>
        </View>
      )}
    </View>
  );
}

function RoundControl({
  icon: Icon,
  label,
  tone,
  large,
  disabled,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  tone: 'primary' | 'dark';
  large?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const size = large ? 88 : 76;

  return (
    <View style={styles.control}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        onPress={onPress}
        style={({pressed}) => [
          {width: size, height: size, borderRadius: size / 2},
          styles.controlButton,
          tone === 'primary' ? styles.controlPrimary : styles.controlDark,
          pressed && styles.controlPressed,
          disabled && styles.controlDisabled,
        ]}
      >
        <Icon color={colors.textOnPrimary} size={large ? 34 : 28} fill={colors.textOnPrimary} strokeWidth={1.5} />
      </Pressable>
      <AppText variant="subheading" color={colors.text}>
        {label}
      </AppText>
    </View>
  );
}

function Stat({label, value, unit}: {label: string; value: string; unit: string}) {
  return (
    <View style={styles.stat}>
      <AppText variant="label" color={colors.textMuted}>
        {label}
      </AppText>
      <AppText variant="number">{value}</AppText>
      <AppText variant="caption" color={colors.textSubtle}>
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
  {elapsedSec, distanceKm, calories}: {elapsedSec: number; distanceKm: number; calories: number},
) {
  if (!goalValue || goalType === 'free') return null;
  if (goalType === 'time') return elapsedSec / (goalValue * 60);
  if (goalType === 'distance') return distanceKm / goalValue;
  return calories / goalValue;
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: colors.sky, paddingHorizontal: spacing.xl},
  header: {height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginRight: -spacing.sm},
  clockBlock: {marginTop: spacing.lg, gap: spacing.xs},
  clock: {...typography.display, fontSize: 64, lineHeight: 72, fontVariant: ['tabular-nums']},
  stats: {flexDirection: 'row', alignItems: 'center', marginTop: spacing.xl, paddingVertical: spacing.lg, paddingHorizontal: spacing.sm},
  stat: {flex: 1, alignItems: 'center', gap: 2},
  divider: {width: StyleSheet.hairlineWidth, height: 44, backgroundColor: colors.border},
  progress: {marginTop: spacing.lg, gap: spacing.sm},
  ground: {flex: 1, marginHorizontal: -spacing.xl, marginTop: spacing.md},
  // 캐릭터 PNG의 발 위치(약 82%)가 땅 윗면에 오도록 끌어올린다
  character: {marginTop: -CHARACTER_SIZE * 0.82},
  gpsWarning: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginBottom: spacing.md},
  controls: {position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: spacing.xxxl + spacing.lg},
  control: {alignItems: 'center', gap: spacing.sm},
  controlButton: {alignItems: 'center', justifyContent: 'center', ...shadow.floating},
  controlPrimary: {backgroundColor: colors.primary},
  controlDark: {backgroundColor: colors.text},
  controlPressed: {transform: [{scale: 0.95}], opacity: 0.9},
  controlDisabled: {opacity: 0.4},
  countdownOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  countdownText: {...typography.display, fontSize: 160, lineHeight: 176},
});
