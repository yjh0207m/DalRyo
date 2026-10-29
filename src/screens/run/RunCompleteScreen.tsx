import {useDialect} from '../../locales/DialectProvider';
import type {Translate} from '../../locales/translate';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Animated, Easing, StatusBar, StyleSheet, View, useWindowDimensions} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Camera, CalendarDays, X} from 'lucide-react-native';
import {CharacterReveal} from '../../components/character/CharacterReveal';
import {Confetti} from '../../components/celebrate/Confetti';
import {Stamp} from '../../components/celebrate/Stamp';
import {useCountUp} from '../../components/celebrate/useCountUp';
import {RouteMap} from '../../components/maps/RouteMap';
import {MeadowScene} from '../../components/scene/MeadowScene';
import {AppText, Button, Card, IconButton} from '../../components/ui';
import {colors, radius, spacing, typography} from '../../theme';
import type {CharacterStage, CharacterType, EquippedOutfit} from '../../types/character.types';
import type {GpsPoint} from '../../types/run.types';
import {STAGE_LABELS, calculateRunExp, getNextStageProgress} from '../../utils/exp';
import {formatDuration, formatPace} from '../../utils/pace';
import {getRevealMode, type RevealMode} from '../../utils/reveal';

type Props = {
  distanceKm: number;
  growthDistanceKm?: number;
  durationSec: number;
  avgPaceSec: number;
  calories: number;
  // 달린 경로. 있으면 기록 카드 위에 출발·도착이 표시된 지도를 보여 준다
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
const MEADOW_HEIGHT = 170;

// 완료 화면 순서: 캐릭터 등장 연출(CharacterReveal) → 기록 숫자가 차오름 → 경험치 막대 → '완주' 도장 → 버튼 활성화
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
  const mode = getRevealMode(stageBeforeRun, stageAfterRun, growthDistanceKm, wasFrozen);
  const [revealed, setRevealed] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const [stamped, setStamped] = useState(false);
  // 캐릭터 연출이 끝나기 전에는 기록 카드를 숨겨 시선을 캐릭터에 둔다
  const cardIn = useRef(new Animated.Value(0)).current;

  const onRevealed = useCallback((big: boolean) => {
    setRevealed(true);
    setConfetti(big);
  }, []);

  useEffect(() => {
    if (!revealed) return undefined;
    Animated.spring(cardIn, {toValue: 1, friction: 8, tension: 70, useNativeDriver: true}).start();
    const timer = setTimeout(() => setStamped(true), 1100);
    return () => clearTimeout(timer);
  }, [revealed, cardIn]);

  const {title, subtitle} = getHeadline({mode, revealed, petName, stage: stageAfterRun, t});

  // 하단(기록 카드 + 버튼 + 안전 영역) 높이만큼 풀밭 색을 이어 칠해 초원이 화면 아래까지 이어지게 한다.
  // 초원 그림 자체를 늘리면 언덕이 가팔라져 캐릭터가 떠 보이므로 그림 높이는 고정한다
  const [bottomBlockHeight, setBottomBlockHeight] = useState(300);
  const bottomInset = bottomBlockHeight + insets.bottom + spacing.xl;

  return (
    <View style={[styles.screen, {paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.xl}]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={styles.header}>
        <IconButton icon={X} variant="plain" accessibilityLabel="닫기" onPress={onClose} />
      </View>

      <Headline title={title} subtitle={subtitle} />

      {/* 달리기 화면과 같은 초원에서 등장 연출. 초원은 화면 아래 끝까지 깔고, 기록 카드가 풀밭 위에 놓인다 */}
      <View style={styles.stage} />
      <View pointerEvents="box-none" style={styles.meadowLayer}>
        <MeadowScene height={MEADOW_HEIGHT} groundRatio={0.42}>
          <View style={styles.actor}>
            <CharacterReveal equipped={equipped} mode={mode} type={characterType} stageBefore={stageBeforeRun} stageAfter={stageAfterRun} size={CHARACTER_SIZE} onRevealed={onRevealed} />
          </View>
        </MeadowScene>
        <View style={[styles.grassFill, {height: bottomInset}]} />
      </View>

      <Animated.View
        onLayout={event => setBottomBlockHeight(event.nativeEvent.layout.height)}
        style={{opacity: cardIn, transform: [{translateY: cardIn.interpolate({inputRange: [0, 1], outputRange: [40, 0]})}]}}
      >
        <Card padded={false} style={styles.stats}>
          {route && (
            <View style={styles.mapBox}>
              <RouteMap route={route} compact />
            </View>
          )}
          <ResultStats distanceKm={distanceKm} durationSec={durationSec} avgPaceSec={avgPaceSec} calories={calories} start={revealed} />
          <View style={styles.hDivider} />
          <GrowthRow distanceKm={growthDistanceKm} stageBefore={stageBeforeRun} stageAfter={stageAfterRun} totalKmBefore={totalKmBefore} start={revealed} />
          <Stamp label="완주!" show={stamped} style={styles.stamp} />
        </Card>

        <View style={styles.actions}>
          {onTakePhoto && <Button label="달료랑 사진 찍기" icon={Camera} variant="secondary" disabled={!revealed} onPress={onTakePhoto} />}
          <Button label="기록 보기" icon={CalendarDays} disabled={!revealed} onPress={onViewRecord} />
        </View>
      </Animated.View>

      {confetti && <Confetti width={window.width} height={window.height * 0.7} />}
    </View>
  );
}

// 제목은 바뀔 때마다 살짝 떠오르며 바뀐다
function Headline({title, subtitle}: {title: string; subtitle: string}) {
  const appear = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    appear.setValue(0);
    Animated.timing(appear, {toValue: 1, duration: 360, easing: Easing.out(Easing.cubic), useNativeDriver: true}).start();
  }, [appear, title]);
  return (
    <Animated.View
      style={[styles.titleBlock, {opacity: appear, transform: [{translateY: appear.interpolate({inputRange: [0, 1], outputRange: [10, 0]})}]}]}
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

function ResultStats({distanceKm, durationSec, avgPaceSec, calories, start}: {distanceKm: number; durationSec: number; avgPaceSec: number; calories: number; start: boolean}) {
  const km = useCountUp(distanceKm, start);
  const sec = useCountUp(durationSec, start);
  const kcal = useCountUp(calories, start);
  const pace = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (start) Animated.timing(pace, {toValue: 1, duration: 500, delay: 600, useNativeDriver: true}).start();
  }, [pace, start]);

  return (
    // 지도가 들어갈 자리를 위해 네 가지 기록을 한 줄에 둔다
    <View style={styles.statsRow}>
      <Stat label="거리" value={km.toFixed(2)} unit="km" />
      <View style={styles.vDivider} />
      <Stat label="시간" value={formatDuration(Math.round(sec))} unit="분:초" />
      <View style={styles.vDivider} />
      <Stat label="페이스" value={avgPaceSec > 0 ? formatPace(avgPaceSec) : `-'--"`} unit="/km" opacity={pace} />
      <View style={styles.vDivider} />
      <Stat label="칼로리" value={String(Math.round(kcal))} unit="kcal" />
    </View>
  );
}

// +EXP와 다음 단계까지 진행 막대. 이번 달리기만큼 막대가 차오른다
function GrowthRow({distanceKm, stageBefore, stageAfter, totalKmBefore, start}: {distanceKm: number; stageBefore: CharacterStage; stageAfter: CharacterStage; totalKmBefore?: number; start: boolean}) {
  const exp = calculateRunExp(distanceKm);
  const shownExp = useCountUp(exp, start, 1100);
  const fill = useRef(new Animated.Value(0)).current;
  const hasTotal = totalKmBefore !== undefined;
  const after = hasTotal ? getNextStageProgress(stageAfter, totalKmBefore + distanceKm) : null;
  const before = hasTotal && stageBefore === stageAfter ? getNextStageProgress(stageBefore, totalKmBefore)?.progress ?? 0 : 0;

  useEffect(() => {
    fill.setValue(before);
    if (start && after) {
      Animated.timing(fill, {toValue: after.progress, duration: 1100, delay: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true}).start();
    }
  }, [fill, start, before, after?.progress, after]);

  const label = after ? `${STAGE_LABELS[after.next]}까지 ${after.remainingKm.toFixed(1)}km` : stageAfter === 'runner' ? '최종 단계 · 러너' : '';

  return (
    <View style={styles.growth}>
      <View style={styles.expPill}>
        <AppText style={styles.expText}>+{Math.round(shownExp)} EXP</AppText>
      </View>
      {after ? (
        <View style={styles.growthBar}>
          <View style={styles.track}>
            <Animated.View style={[styles.fill, {transform: [{scaleX: fill}]}]} />
          </View>
          <AppText variant="caption" color={colors.textMuted}>
            {label}
          </AppText>
        </View>
      ) : (
        <AppText variant="caption" color={colors.textMuted} style={styles.growthBar}>
          {label}
        </AppText>
      )}
    </View>
  );
}

function getHeadline({mode, revealed, petName, stage, t}: {mode: RevealMode; revealed: boolean; petName: string; stage: CharacterStage; t: Translate}) {
  if (!revealed) {
    if (mode === 'hatch') return {title: '알이 흔들려요', subtitle: '첫 달리기 덕분에 알이 깨어나고 있어요'};
    if (mode === 'grow') return {title: `${petName}의 몸이 빛나요`, subtitle: '꾸준히 달린 힘이 모이고 있어요'};
    if (mode === 'thaw') return {title: '돌에 금이 가요', subtitle: '달리기 덕분에 몸이 풀리고 있어요'};
  }
  if (mode === 'hatch') return {title: `${petName} 탄생!`, subtitle: '첫 달리기를 축하해요. 이제 함께 자라요'};
  if (mode === 'grow') return {title: `${petName} ${STAGE_LABELS[stage]}로 성장!`, subtitle: '꾸준히 달린 덕분에 한 단계 자랐어요'};
  if (mode === 'thaw') return {title: `${petName} 해동 완료`, subtitle: '다시 움직일 수 있게 됐어요. 자주 달려 주세요'};
  return {title: t('run.complete'), subtitle: t('run.completeBody', {name: petName})};
}

function Stat({label, value, unit, opacity}: {label: string; value: string; unit: string; opacity?: Animated.Value}) {
  return (
    <Animated.View style={[styles.stat, opacity && {opacity}]}>
      <AppText variant="label" color={colors.textMuted}>
        {label}
      </AppText>
      <AppText style={styles.statNumber} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </AppText>
      <AppText variant="caption" color={colors.textSubtle}>
        {unit}
      </AppText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.xl},
  header: {height: 48, alignItems: 'flex-end', justifyContent: 'center', marginRight: -spacing.sm},
  titleBlock: {gap: spacing.xs},
  stage: {flex: 1},
  meadowLayer: {position: 'absolute', left: 0, right: 0, bottom: 0},
  grassFill: {backgroundColor: colors.grassDeep},
  // 캐릭터 그림의 발(82%)이 땅 윗면에 오도록 상자 아래쪽을 땅 속으로 내린다
  actor: {marginBottom: -CHARACTER_SIZE * 0.17},
  stats: {marginBottom: spacing.lg},
  statsRow: {flexDirection: 'row', alignItems: 'center'},
  stat: {flex: 1, alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: 2, gap: 2},
  statNumber: {...typography.number, fontSize: 20, lineHeight: 26},
  mapBox: {padding: spacing.sm, paddingBottom: 0},
  vDivider: {width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginVertical: spacing.lg, backgroundColor: colors.border},
  hDivider: {height: StyleSheet.hairlineWidth, marginHorizontal: spacing.xl, backgroundColor: colors.border},
  growth: {flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md},
  expPill: {backgroundColor: colors.gold, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6},
  expText: {...typography.subheading, color: colors.goldInk, fontVariant: ['tabular-nums']},
  growthBar: {flex: 1, gap: 6},
  track: {height: 10, borderRadius: 5, backgroundColor: colors.primarySoft, overflow: 'hidden'},
  fill: {height: 10, borderRadius: 5, backgroundColor: colors.primary, transformOrigin: 'left'},
  // 카드 위 가장자리에 걸쳐 찍어 숫자·이름을 가리지 않는다
  stamp: {top: -34, right: spacing.sm},
  actions: {gap: spacing.sm},
});
