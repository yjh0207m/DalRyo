import { useDialect } from '../../locales/DialectProvider';
import type { Translate } from '../../locales/translate';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, CalendarDays, X } from 'lucide-react-native';
import { CharacterReveal } from '../../components/character/CharacterReveal';
import { Confetti } from '../../components/celebrate/Confetti';
import { useCountUp } from '../../components/celebrate/useCountUp';
import { RouteMap } from '../../components/maps/RouteMap';
import { MeadowScene } from '../../components/scene/MeadowScene';
import { AppText, Button, IconButton, ProgressBar } from '../../components/ui';
import { colors, fonts, radius, spacing, typography } from '../../theme';
import type {
  CharacterStage,
  CharacterType,
  EquippedOutfit,
} from '../../types/character.types';
import type { GpsPoint } from '../../types/run.types';
import {
  STAGE_LABELS,
  calculateRunExp,
  getNextStageProgress,
} from '../../utils/exp';
import { formatDuration, formatPace } from '../../utils/pace';
import { getRevealMode, type RevealMode } from '../../utils/reveal';

type Props = {
  distanceKm: number;
  growthDistanceKm?: number;
  durationSec: number;
  avgPaceSec: number;
  calories: number;
  // 저장된 달리기 경로의 미리보기
  route?: readonly GpsPoint[];
  characterType: CharacterType;
  equipped?: EquippedOutfit;
  petName: string;
  // 이번 달리기 전 캐릭터 단계. 'egg'이고 거리가 0보다 크면 부화 연출
  stageBeforeRun: CharacterStage;
  // 이번 달리기 반영 후 단계 (getCharacterStage(total_km))
  stageAfterRun: CharacterStage;
  // 달리기 전 누적 거리. 있으면 다음 단계까지 진행 막대를 보여 준다
  totalKmBefore?: number;
  // 돌 변신 상태에서 달렸으면 해동 연출
  wasFrozen?: boolean;
  // 카메라 필터(F-CAM-01) 구현 전에는 넘기지 않으면 버튼이 숨겨진다
  onTakePhoto?: () => void;
  onViewRecord: () => void;
  onClose: () => void;
};

const CHARACTER_SIZE = 200;
const MEADOW_HEIGHT = 220;

export function RunCompleteScreen({
  distanceKm,
  growthDistanceKm = distanceKm,
  durationSec,
  avgPaceSec,
  calories,
  route,
  characterType,
  equipped,
  petName,
  stageBeforeRun,
  stageAfterRun,
  totalKmBefore,
  wasFrozen = false,
  onTakePhoto,
  onViewRecord,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const t = useDialect();
  const mode = getRevealMode(
    stageBeforeRun,
    stageAfterRun,
    growthDistanceKm,
    wasFrozen,
  );
  const [revealed, setRevealed] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const onRevealed = useCallback((big: boolean) => {
    setRevealed(true);
    setConfetti(big);
  }, []);

  const { title, subtitle } = getHeadline({
    mode,
    revealed,
    petName,
    stage: stageAfterRun,
    t,
  });
  const sceneHeight = revealed ? 100 : MEADOW_HEIGHT;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={styles.header}>
        <AppText variant="subheading">
          {revealed ? '달리기 완료' : '달리기 결과'}
        </AppText>
        <IconButton
          icon={X}
          variant="plain"
          accessibilityLabel="닫기"
          onPress={onClose}
        />
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          !revealed && styles.revealContent,
        ]}
      >
        {revealed && <DistanceResult distanceKm={distanceKm} />}
        {!revealed && <Headline title={title} subtitle={subtitle} />}
        <View style={[styles.growthPanel, !revealed && styles.revealPanel]}>
          <View style={styles.sceneClip}>
            <MeadowScene height={sceneHeight} groundRatio={0.24}>
              <View
                style={[
                  styles.actor,
                  { marginBottom: -(revealed ? 106 : CHARACTER_SIZE) * 0.17 },
                ]}
              >
                <CharacterReveal
                  equipped={equipped}
                  mode={mode}
                  type={characterType}
                  stageBefore={stageBeforeRun}
                  stageAfter={stageAfterRun}
                  size={revealed ? 106 : CHARACTER_SIZE}
                  onRevealed={onRevealed}
                />
              </View>
            </MeadowScene>
          </View>
          {revealed && (
            <GrowthRow
              distanceKm={growthDistanceKm}
              stageBefore={stageBeforeRun}
              stageAfter={stageAfterRun}
              totalKmBefore={totalKmBefore}
              title={mode === 'complete' ? '오늘의 성장' : title}
            />
          )}
        </View>
        {revealed && (
          <View style={styles.details}>
            <AppText variant="heading">달리기 상세</AppText>
            <View style={styles.statsRow}>
              <Stat
                label="시간"
                value={formatDuration(durationSec)}
                unit="분:초"
              />
              <Stat
                label="평균 페이스"
                value={avgPaceSec > 0 ? formatPace(avgPaceSec) : '—'}
                unit="/km"
              />
              <Stat label="칼로리" value={String(calories)} unit="kcal" />
            </View>
            {!!route && route.length > 1 && <RouteMap route={route} compact />}
          </View>
        )}
      </ScrollView>
      {revealed && (
        <View
          style={[
            styles.actions,
            { paddingBottom: insets.bottom + spacing.sm },
          ]}
        >
          <Button
            label="기록 보기"
            icon={CalendarDays}
            onPress={onViewRecord}
          />
          {onTakePhoto && (
            <Button
              label="달료랑 사진 찍기"
              icon={Camera}
              variant="ghost"
              size="md"
              onPress={onTakePhoto}
            />
          )}
        </View>
      )}
      {confetti && (
        <Confetti width={window.width} height={window.height * 0.7} />
      )}
    </View>
  );
}

// 제목은 바뀔 때마다 살짝 떠오르며 바뀐다
function Headline({ title, subtitle }: { title: string; subtitle: string }) {
  const appear = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    appear.setValue(0);
    Animated.timing(appear, {
      toValue: 1,
      duration: 360,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [appear, title]);
  return (
    <Animated.View
      style={[
        styles.titleBlock,
        {
          opacity: appear,
          transform: [
            {
              translateY: appear.interpolate({
                inputRange: [0, 1],
                outputRange: [10, 0],
              }),
            },
          ],
        },
      ]}
    >
      <AppText variant="title" align="center">
        {title}
      </AppText>
      <AppText variant="body" color={colors.textMuted} align="center">
        {subtitle}
      </AppText>
    </Animated.View>
  );
}

function DistanceResult({ distanceKm }: { distanceKm: number }) {
  const km = useCountUp(distanceKm, true);
  return (
    <View
      style={styles.distanceResult}
      accessibilityLabel={`달린 거리 ${distanceKm.toFixed(2)}킬로미터`}
    >
      <AppText variant="label" color={colors.textMuted}>
        달린 거리
      </AppText>
      <View style={styles.distanceValue}>
        <AppText
          style={styles.distanceNumber}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {km.toFixed(2)}
        </AppText>
        <AppText variant="heading" color={colors.primaryInk}>
          km
        </AppText>
      </View>
    </View>
  );
}

function GrowthRow({
  distanceKm,
  stageBefore,
  stageAfter,
  totalKmBefore,
  title,
}: {
  distanceKm: number;
  stageBefore: CharacterStage;
  stageAfter: CharacterStage;
  totalKmBefore?: number;
  title: string;
}) {
  const exp = calculateRunExp(distanceKm);
  const before =
    totalKmBefore === undefined
      ? null
      : getNextStageProgress(stageBefore, totalKmBefore);
  const after =
    totalKmBefore === undefined
      ? null
      : getNextStageProgress(stageAfter, totalKmBefore + distanceKm);
  const previousKm = before?.remainingKm.toFixed(1);
  const remainingKm = after?.remainingKm.toFixed(1);
  const showChange =
    stageBefore === stageAfter &&
    previousKm != null &&
    previousKm !== remainingKm;

  return (
    <View style={styles.growth}>
      <AppText variant="subheading">{title}</AppText>
      {after ? (
        <>
          <AppText variant="caption" color={colors.textMuted}>
            {STAGE_LABELS[after.next]}까지
          </AppText>
          <AppText variant="heading" color={colors.primaryInk}>
            {showChange
              ? `${previousKm} → ${remainingKm} km`
              : `${remainingKm} km 남음`}
          </AppText>
          <ProgressBar
            value={after.progress}
            height={5}
            trackColor={colors.primaryBorder}
          />
        </>
      ) : stageAfter === 'runner' ? (
        <AppText variant="caption" color={colors.textMuted}>
          최종 단계 · 러너
        </AppText>
      ) : null}
      <AppText variant="label" color={colors.primaryInk}>
        +{exp} EXP
      </AppText>
    </View>
  );
}

function getHeadline({
  mode,
  revealed,
  petName,
  stage,
  t,
}: {
  mode: RevealMode;
  revealed: boolean;
  petName: string;
  stage: CharacterStage;
  t: Translate;
}) {
  if (!revealed) {
    if (mode === 'hatch')
      return {
        title: '알이 흔들려요',
        subtitle: '첫 달리기 덕분에 알이 깨어나고 있어요',
      };
    if (mode === 'grow')
      return {
        title: `${petName}의 몸이 빛나요`,
        subtitle: '꾸준히 달린 힘이 모이고 있어요',
      };
    if (mode === 'thaw')
      return {
        title: '돌에 금이 가요',
        subtitle: '달리기 덕분에 몸이 풀리고 있어요',
      };
  }
  if (mode === 'hatch')
    return {
      title: `${petName} 탄생!`,
      subtitle: '첫 달리기를 축하해요. 이제 함께 자라요',
    };
  if (mode === 'grow')
    return {
      title: `${petName} ${STAGE_LABELS[stage]}로 성장!`,
      subtitle: '꾸준히 달린 덕분에 한 단계 자랐어요',
    };
  if (mode === 'thaw')
    return {
      title: `${petName} 해동 완료`,
      subtitle: '다시 움직일 수 있게 됐어요. 자주 달려 주세요',
    };
  return {
    title: t('run.complete'),
    subtitle: t('run.completeBody', { name: petName }),
  };
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
      <AppText variant="caption" color={colors.textSubtle}>
        {unit}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: spacing.xl,
    paddingRight: spacing.md,
  },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  revealContent: { flexGrow: 1, justifyContent: 'center' },
  titleBlock: { gap: spacing.xs },
  growthPanel: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  revealPanel: { backgroundColor: colors.sceneSky },
  sceneClip: { overflow: 'hidden' },
  actor: { alignItems: 'center' },
  distanceResult: { gap: spacing.xs, paddingTop: spacing.xs },
  distanceValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  distanceNumber: {
    ...typography.display,
    fontFamily: fonts.extrabold,
    flexShrink: 1,
    fontVariant: ['tabular-nums'],
  },
  growth: {
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  details: {
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.lg,
  },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, minWidth: 0, gap: 2 },
  statNumber: {
    ...typography.number,
    fontSize: 20,
    lineHeight: 26,
    fontVariant: ['tabular-nums'],
  },
  actions: {
    gap: spacing.xs,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
