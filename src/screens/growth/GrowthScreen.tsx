import React, { useCallback, useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { Footprints, Sparkles } from 'lucide-react-native';
import {
  AppText,
  Badge,
  Button,
  Card,
  ProgressBar,
  ScreenHeader,
  TallNumber,
} from '../../components/ui';
import { RunRecordsStatus } from '../../components/ui/RunRecordsStatus';
import { useRunRecords } from '../../hooks/useRunRecords';
import { TAB_BAR_HEIGHT } from '../../navigation/BottomTabBar';
import {
  fetchRunsBetween,
  getRunStartedAtDate,
} from '../../services/run.service';
import { colors, fonts, radius, spacing, themedStyles } from '../../theme';
import type { CharacterDocument } from '../../types/character.types';
import type { RunDocument } from '../../types/run.types';
import type { UserDocument } from '../../types/user.types';
import { STAGE_LABELS, STAT_MAX } from '../../utils/exp';

type Props = {
  user: UserDocument | null;
  character: CharacterDocument | null;
  hasUnread?: boolean;
  onNotificationPress: () => void;
  onSettingsPress: () => void;
  // 달리기 시작 시트를 연다(최근 7일 기록이 없을 때)
  onStartRun?: () => void;
};

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const CHART_HEIGHT = 120;
// 누적 거리 큰 숫자의 글자 크기·줄 높이 (세로로 살짝 늘려 그린다)
const TOTAL_FONT_SIZE = 64;
const TOTAL_LINE_HEIGHT = 74;

// 성장 리포트 (Figma: "성장 리포트 - AI 코치, 성장 그래프"). AI 코치는 2단계 기능이라 미리보기 카드만 둔다
export function GrowthScreen({
  user,
  character,
  onNotificationPress,
  onSettingsPress,
  hasUnread,
  onStartRun,
}: Props) {
  const insets = useSafeAreaInsets();
  const lastRunAtMs = user?.last_run_at?.toMillis() ?? null;
  const loadRuns = useCallback(() => {
    const now = new Date();
    return fetchRunsBetween(
      new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6),
      now,
    );
  }, []);
  const { runs, status, retry } = useRunRecords(loadRuns, lastRunAtMs);
  const days = useMemo(() => buildLast7Days(runs), [runs]);
  const maxKm = Math.max(0.1, ...days.map(day => day.km));
  const weekKm = days.reduce((sum, day) => sum + day.km, 0);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        style={styles.screen}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: spacing.sm,
            paddingBottom: TAB_BAR_HEIGHT + insets.bottom + spacing.xxxl,
          },
        ]}
      >
        <ScreenHeader
          hasUnread={hasUnread}
          title="성장"
          onNotificationPress={onNotificationPress}
          onSettingsPress={onSettingsPress}
        />

        {/* 누적 거리를 가장 크게 두고, 그 아래 한 줄에 최근 7일과 EXP를 나란히 둔다 */}
        <View testID="growth-summary" style={styles.summary}>
          <View testID="growth-total">
            <AppText variant="label" color={colors.textMuted}>
              누적 거리
            </AppText>
            <View style={styles.totalValue}>
              {/* 세로로 살짝 늘린 키 큰 숫자 */}
              <TallNumber
                fontSize={TOTAL_FONT_SIZE}
                lineHeight={TOTAL_LINE_HEIGHT}
                style={styles.totalNumber}
                color={colors.primaryInk}
                numberOfLines={1}
              >
                {(user?.total_km ?? 0).toFixed(1)}
              </TallNumber>
              <AppText variant="subheading" color={colors.textMuted}>
                km
              </AppText>
            </View>
          </View>
          <View testID="growth-secondary" style={styles.secondaryRow}>
            <Summary
              label="최근 7일"
              value={status === 'success' ? weekKm.toFixed(1) : '—'}
              unit="km"
            />
            <View style={styles.secondaryDivider} />
            <Summary
              label="EXP"
              value={(user?.total_exp ?? 0).toLocaleString()}
              unit=""
            />
          </View>
        </View>

        <Card tone="flat" padded={false} style={styles.section}>
          <View style={styles.sectionHeader}>
            <AppText variant="subheading">최근 7일 거리</AppText>
            <AppText variant="caption" color={colors.textMuted}>
              km
            </AppText>
          </View>
          {status !== 'success' ? (
            <RunRecordsStatus status={status} onRetry={retry} />
          ) : (
            <View style={styles.chart}>
              {weekKm === 0 && (
                <View style={styles.chartEmpty} pointerEvents="box-none">
                  <AppText variant="caption" color={colors.textMuted}>
                    최근 7일 동안 달린 기록이 없어요
                  </AppText>
                  {onStartRun && (
                    <Button
                      label="달리기 시작"
                      icon={Footprints}
                      variant="secondary"
                      size="md"
                      onPress={onStartRun}
                    />
                  )}
                </View>
              )}
              {days.map(day => (
                <View key={day.key} style={styles.barColumn}>
                  <View style={styles.barTrack}>
                    {day.km > 0 && (
                      <AppText variant="label" color={colors.primaryInk}>
                        {day.km.toFixed(1)}
                      </AppText>
                    )}
                    <View
                      style={[
                        styles.bar,
                        {
                          height: Math.max(4, (day.km / maxKm) * CHART_HEIGHT),
                        },
                        day.km === 0 && styles.barEmpty,
                        day.isToday && day.km > 0 && styles.barToday,
                      ]}
                    />
                  </View>
                  <AppText
                    variant="label"
                    color={day.isToday ? colors.text : colors.textSubtle}
                  >
                    {day.label}
                  </AppText>
                </View>
              ))}
            </View>
          )}
        </Card>

        {character && (
          <Card tone="flat" padded={false} style={styles.section}>
            <View style={styles.sectionHeader}>
              <AppText variant="subheading">
                {character.pet_name}의 스탯
              </AppText>
              <Badge label={STAGE_LABELS[character.stage]} />
            </View>
            <StatRow label="체력" value={character.stat_stamina} />
            <StatRow label="속도" value={character.stat_speed} />
            <StatRow label="지구력" value={character.stat_endurance} />
          </Card>
        )}

        <Card tone="flat" padded={false} style={[styles.section, styles.coach]}>
          <View style={styles.coachIcon}>
            <Sparkles color={colors.primaryInk} size={22} />
          </View>
          <View style={styles.coachText}>
            <AppText variant="subheading">AI 코치 · 준비 중</AppText>
            <AppText variant="caption" color={colors.textMuted}>
              달리기 기록을 분석해서 페이스와 훈련 계획을 추천해 드릴게요
            </AppText>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function buildLast7Days(runs: RunDocument[]) {
  const now = new Date();
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - (6 - index),
    );
    const km = runs
      .filter(
        run => getRunStartedAtDate(run).toDateString() === date.toDateString(),
      )
      .reduce((sum, run) => sum + run.distance_km, 0);
    return {
      key: date.toDateString(),
      label: DAY_LABELS[date.getDay()],
      km,
      isToday: index === 6,
    };
  });
}

// 누적 거리 아래 한 줄에 나란히 놓이는 보조 수치
function Summary({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <View style={styles.secondaryItem}>
      <AppText variant="label" color={colors.textMuted}>
        {label}
      </AppText>
      <View style={styles.summaryValue}>
        <AppText variant="number" numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </AppText>
        {!!unit && (
          <AppText variant="caption" color={colors.textMuted}>
            {unit}
          </AppText>
        )}
      </View>
    </View>
  );
}

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statRow}>
      <AppText variant="caption" style={styles.statLabel}>
        {label}
      </AppText>
      <View style={styles.statBar}>
        <ProgressBar value={value / STAT_MAX} height={6} />
      </View>
      <AppText
        variant="caption"
        color={colors.textMuted}
        style={styles.statValue}
      >
        {value}
      </AppText>
    </View>
  );
}

const styles = themedStyles(() => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: spacing.xl },
  // 누적 거리 구역. 큰 숫자와 아래 보조 수치 줄이 붙어 보이지 않도록 위아래와 사이를 넉넉히 띄운다
  summary: {
    // 헤더 아래 첫 요소. 부제목이 있던 때의 여백(xl)을 줄여 다른 탭과 간격을 맞춘다
    marginTop: spacing.sm,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.xxl,
  },
  totalValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  totalNumber: {
    fontFamily: fonts.extrabold,
    letterSpacing: -2.2,
    fontVariant: ['tabular-nums'],
  },
  secondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  secondaryItem: { flex: 1, gap: spacing.sm },
  secondaryDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: colors.border,
    marginRight: spacing.lg,
  },
  summaryValue: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  section: { marginTop: spacing.section },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  chart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  chartEmpty: {
    ...StyleSheet.absoluteFill,
    bottom: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    zIndex: 1,
  },
  barColumn: { alignItems: 'center', gap: spacing.xs, flex: 1 },
  barTrack: {
    height: CHART_HEIGHT + 22,
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing.xs,
  },
  bar: {
    width: 23,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryBorder,
  },
  barEmpty: { backgroundColor: colors.surfaceMuted },
  barToday: { backgroundColor: colors.primary },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  statLabel: { width: 52 },
  statBar: { flex: 1 },
  statValue: { width: 36, textAlign: 'right' },
  coach: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  coachIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachText: { flex: 1, gap: 2 },
}));
