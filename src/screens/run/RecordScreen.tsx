import { useDialect } from '../../locales/DialectProvider';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {
  ArrowUpRight,
  List,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Footprints,
  Route,
} from 'lucide-react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { FINISH_COLOR, START_COLOR, routeSegments } from '../../utils/routeMap';
import {
  AppText,
  Badge,
  Card,
  IconButton,
  ScreenHeader,
} from '../../components/ui';
import { RunDetailScreen } from './RunDetailScreen';
import type { CharacterDocument } from '../../types/character.types';
import { RunRecordsStatus } from '../../components/ui/RunRecordsStatus';
import { useRunRecords } from '../../hooks/useRunRecords';
import { TAB_BAR_HEIGHT } from '../../navigation/BottomTabBar';
import {
  fetchMonthlyRuns,
  getRunStartedAtDate,
} from '../../services/run.service';
import { colors, fonts, radius, spacing } from '../../theme';
import type { RunDocument } from '../../types/run.types';
import { formatDuration, formatPace } from '../../utils/pace';
import {
  buildCalendarCells,
  projectRunRoute,
  summarizeRunPeriod,
} from '../../utils/runRecords';

type Props = {
  hasUnread?: boolean;
  onNotificationPress: () => void;
  onSettingsPress: () => void;
  character?: CharacterDocument | null;
  onSubpageChange?: (open: boolean) => void;
};
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const GOAL_LABELS = {
  free: '자유 달리기',
  time: '시간 목표',
  distance: '거리 목표',
  calorie: '칼로리 목표',
};

export function RecordScreen({
  onNotificationPress,
  onSettingsPress,
  hasUnread,
  character = null,
  onSubpageChange,
}: Props) {
  const insets = useSafeAreaInsets();
  const t = useDialect();
  const now = new Date();
  const [period, setPeriod] = useState({
    year: now.getFullYear(),
    month: now.getMonth(),
  });
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedRun, setSelectedRun] = useState<RunDocument | null>(null);
  useEffect(() => {
    onSubpageChange?.(!!selectedRun);
    return () => onSubpageChange?.(false);
  }, [selectedRun, onSubpageChange]);
  const { year, month } = period;
  const loadRuns = useCallback(
    () => fetchMonthlyRuns(year, month),
    [year, month],
  );
  const { runs, status, retry } = useRunRecords(loadRuns);
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const runsByDay = useMemo(() => {
    const grouped = new Map<number, RunDocument[]>();
    runs.forEach(run => {
      const day = getRunStartedAtDate(run).getDate();
      grouped.set(day, [...(grouped.get(day) ?? []), run]);
    });
    return grouped;
  }, [runs]);
  const selectedRuns =
    selectedDay === null ? null : runsByDay.get(selectedDay) ?? [];
  const summary = useMemo(() => summarizeRunPeriod(runs), [runs]);
  const moveMonth = (delta: number) => {
    const date = new Date(year, month + delta, 1);
    setSelectedDay(null);
    setPeriod({ year: date.getFullYear(), month: date.getMonth() });
  };
  if (selectedRun)
    return (
      <RunDetailScreen
        run={selectedRun}
        character={character}
        onBack={() => setSelectedRun(null)}
      />
    );
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
        refreshControl={
          <RefreshControl
            refreshing={status === 'loading'}
            onRefresh={retry}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <ScreenHeader
          hasUnread={hasUnread}
          title="기록"
          onNotificationPress={onNotificationPress}
          onSettingsPress={onSettingsPress}
        />
        <AppText
          variant="caption"
          color={colors.textMuted}
          style={styles.subtitle}
        >
          차곡차곡 쌓이는 나의 달리기
        </AppText>
        <View style={styles.monthControls}>
          <IconButton
            icon={ChevronLeft}
            variant="plain"
            accessibilityLabel="이전 달"
            onPress={() => moveMonth(-1)}
          />
          <AppText variant="heading">
            {year}년 {month + 1}월
          </AppText>
          <IconButton
            icon={ChevronRight}
            variant="plain"
            accessibilityLabel="다음 달"
            onPress={() => moveMonth(1)}
          />
        </View>
        {status === 'success' && (
          <Card style={styles.monthHero}>
            <View style={styles.monthHeroHeading}>
              <AppText variant="label" color={colors.primaryInk}>
                MONTHLY DISTANCE
              </AppText>
              <Badge label={`${runsByDay.size}일 · ${runs.length}회`} />
            </View>
            <View style={styles.distance}>
              <AppText style={styles.monthDistance} color={colors.primaryInk}>
                {summary.distanceKm.toFixed(2)}
              </AppText>
              <AppText variant="heading" color={colors.primaryInk}>
                km
              </AppText>
            </View>
            <View style={styles.monthMetrics}>
              <JournalMetric
                label="총 시간"
                value={formatDuration(summary.durationSec)}
              />
              <JournalMetric
                label="평균 페이스"
                value={
                  summary.distanceKm > 0 ? formatPace(summary.paceSec) : '—'
                }
              />
              <JournalMetric
                label="소모 칼로리"
                value={`${summary.calories} kcal`}
              />
            </View>
          </Card>
        )}
        <View style={styles.viewSwitcher}>
          {(
            [
              ['list', '러닝 저널', List],
              ['calendar', '캘린더', CalendarDays],
            ] as const
          ).map(([mode, label, Icon]) => (
            <Pressable
              key={mode}
              accessibilityRole="tab"
              accessibilityState={{ selected: view === mode }}
              onPress={() => {
                setView(mode);
                setSelectedDay(null);
              }}
              style={[styles.viewTab, view === mode && styles.viewTabActive]}
            >
              <Icon
                size={16}
                color={view === mode ? colors.primaryInk : colors.textMuted}
              />
              <AppText
                variant="caption"
                color={view === mode ? colors.primaryInk : colors.textMuted}
              >
                {label}
              </AppText>
            </Pressable>
          ))}
        </View>
        {view === 'calendar' && (
          <Card style={styles.calendarCard}>
            <View style={styles.calendarGrid}>
              {WEEKDAYS.map(day => (
                <AppText
                  key={day}
                  variant="label"
                  align="center"
                  color={colors.textMuted}
                  style={styles.weekday}
                >
                  {day}
                </AppText>
              ))}
              {buildCalendarCells(year, month).map((day, index) => {
                const hasRun = day !== null && runsByDay.has(day);
                const selected = day !== null && selectedDay === day;
                const today = isCurrentMonth && day === now.getDate();
                return (
                  <View key={index} style={styles.dayCell}>
                    {day !== null && (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${month + 1}월 ${day}일${
                          today ? ', 오늘' : ''
                        }${hasRun ? ', 달리기 기록 있음' : ''}`}
                        accessibilityState={{
                          selected,
                          disabled: status !== 'success',
                        }}
                        disabled={status !== 'success'}
                        onPress={() => setSelectedDay(selected ? null : day)}
                        style={({ pressed }) => [
                          styles.day,
                          today && styles.today,
                          hasRun && styles.recordedDay,
                          selected && styles.selectedDay,
                          pressed && styles.pressed,
                        ]}
                      >
                        <AppText
                          variant="body"
                          color={
                            selected
                              ? colors.textOnPrimary
                              : hasRun
                              ? colors.primaryInk
                              : colors.text
                          }
                        >
                          {day}
                        </AppText>
                        <View
                          style={[
                            styles.dot,
                            hasRun && styles.recordedDot,
                            selected && hasRun && styles.selectedDot,
                          ]}
                        />
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </View>
            <View style={styles.calendarFooter}>
              <View style={styles.legend}>
                <View style={[styles.dot, styles.recordedDot]} />
                <AppText variant="label" color={colors.textMuted}>
                  달린 날
                </AppText>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setPeriod({ year: now.getFullYear(), month: now.getMonth() });
                  setSelectedDay(now.getDate());
                }}
                hitSlop={8}
              >
                <AppText variant="caption" color={colors.primaryInk}>
                  오늘 보기
                </AppText>
              </Pressable>
            </View>
          </Card>
        )}
        {status !== 'success' ? (
          <Card style={styles.section}>
            <RunRecordsStatus status={status} onRetry={retry} />
          </Card>
        ) : (
          <>
            <View style={styles.sectionHeading}>
              <AppText variant="heading">
                {selectedDay === null
                  ? '이번 달 모아보기'
                  : `${month + 1}월 ${selectedDay}일`}
              </AppText>
              <Badge
                label={`${
                  selectedRuns === null ? runs.length : selectedRuns.length
                }회 달리기`}
                tone="neutral"
              />
            </View>
            {(selectedRuns ?? runs).length === 0 ? (
              <Card style={styles.empty}>
                <View style={styles.emptyIcon}>
                  <Footprints size={28} color={colors.primaryInk} />
                </View>
                <AppText variant="subheading">{t('record.empty')}</AppText>
                <AppText
                  variant="caption"
                  color={colors.textMuted}
                  align="center"
                >
                  {t('record.emptyBody')}
                </AppText>
              </Card>
            ) : (
              (selectedRuns ?? runs).map(run => (
                <RunCard
                  key={run.run_id}
                  run={run}
                  onOpen={() => setSelectedRun(run)}
                />
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function JournalMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.journalMetric}>
      <AppText variant="label" color={colors.textMuted}>
        {label}
      </AppText>
      <AppText variant="subheading" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </AppText>
    </View>
  );
}
function RunCard({ run, onOpen }: { run: RunDocument; onOpen: () => void }) {
  const date = getRunStartedAtDate(run);
  const points = projectRunRoute(run.route);
  const first = points[0],
    last = points[points.length - 1];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${
        date.getMonth() + 1
      }월 ${date.getDate()}일 ${run.distance_km.toFixed(2)}km 기록 보기`}
      onPress={onOpen}
      style={({ pressed }) => [styles.runCard, pressed && styles.pressed]}
    >
      <Card style={styles.journalCard}>
        <View style={styles.runHeader}>
          <AppText variant="label" color={colors.textMuted}>
            {date.getMonth() + 1}.{String(date.getDate()).padStart(2, '0')}{' '}
            {['일', '월', '화', '수', '목', '금', '토'][date.getDay()]}요일
          </AppText>
          <Badge label={GOAL_LABELS[run.goal_type]} />
        </View>
        <View style={styles.journalMain}>
          <View style={styles.journalMainText}>
            <View style={styles.distance}>
              <AppText style={styles.runDistance}>
                {run.distance_km.toFixed(2)}
              </AppText>
              <AppText variant="caption" color={colors.textMuted}>
                km
              </AppText>
            </View>
            <AppText variant="caption" color={colors.textMuted}>
              {String(date.getHours()).padStart(2, '0')}:
              {String(date.getMinutes()).padStart(2, '0')}에 남긴 발자국
            </AppText>
          </View>
          <View
            style={styles.routeThumb}
            accessible
            accessibilityLabel={
              points.length > 1 ? 'GPS 경로 미리보기' : '저장된 GPS 경로 없음'
            }
          >
            {points.length > 1 ? (
              <Svg width="100%" height="100%" viewBox="-8 -8 316 176">
                {routeSegments(
                  points.map(point => [point.x, point.y] as [number, number]),
                ).map((segment, index) => (
                  <Polyline
                    key={index}
                    points={segment.points
                      .map(([x, y]) => `${x},${y}`)
                      .join(' ')}
                    fill="none"
                    stroke={segment.color}
                    strokeWidth={7}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
                <Circle
                  cx={first.x}
                  cy={first.y}
                  r={8}
                  fill={START_COLOR}
                  stroke={colors.surface}
                  strokeWidth={4}
                />
                <Circle
                  cx={last.x}
                  cy={last.y}
                  r={8}
                  fill={FINISH_COLOR}
                  stroke={colors.surface}
                  strokeWidth={4}
                />
              </Svg>
            ) : (
              <>
                <Route size={24} color={colors.primaryBorder} />
                <AppText style={styles.noRoute} color={colors.textMuted}>
                  경로 없음
                </AppText>
              </>
            )}
          </View>
        </View>
        <View style={styles.journalStats}>
          <JournalMetric
            label="시간"
            value={formatDuration(run.duration_sec)}
          />
          <JournalMetric
            label="평균 페이스"
            value={run.distance_km > 0 ? formatPace(run.avg_pace_sec) : '—'}
          />
          <JournalMetric label="칼로리" value={`${run.calories} kcal`} />
          <ArrowUpRight size={18} color={colors.primaryInk} />
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.xl },
  subtitle: { marginTop: spacing.xs },
  monthHero: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primarySoft,
    padding: 22,
    marginTop: 4,
  },
  monthHeroHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthDistance: {
    fontFamily: fonts.extrabold,
    fontSize: 50,
    lineHeight: 62,
    letterSpacing: -1.8,
    fontVariant: ['tabular-nums'],
  },
  monthMetrics: {
    flexDirection: 'row',
    paddingTop: 14,
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.primaryBorder,
    gap: 12,
  },
  journalMetric: { flex: 1, gap: 5 },
  viewSwitcher: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    padding: 4,
    marginTop: 22,
  },
  viewTab: {
    flex: 1,
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    borderRadius: 11,
  },
  viewTabActive: { backgroundColor: colors.surface },
  calendarCard: { marginTop: 16 },
  journalCard: { padding: 18 },
  journalMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginVertical: 14,
  },
  journalMainText: { flex: 1 },
  runDistance: {
    fontFamily: fonts.bold,
    fontSize: 37,
    lineHeight: 46,
    letterSpacing: -1.2,
    fontVariant: ['tabular-nums'],
  },
  routeThumb: {
    width: 102,
    height: 82,
    borderRadius: 16,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    gap: 5,
  },
  noRoute: { fontSize: 9, lineHeight: 12 },
  journalStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  section: { marginTop: spacing.lg },
  monthControls: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: '14.285714%', paddingBottom: spacing.sm },
  dayCell: {
    width: '14.285714%',
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  day: {
    width: 38,
    height: 44,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  today: { borderColor: colors.primaryBorder },
  recordedDay: { backgroundColor: colors.primarySoft },
  selectedDay: { backgroundColor: colors.primary, borderColor: colors.primary },
  pressed: { opacity: 0.7 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'transparent' },
  recordedDot: { backgroundColor: colors.primary },
  selectedDot: { backgroundColor: colors.textOnPrimary },
  calendarFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    marginTop: spacing.md,
  },
  legend: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  distance: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    marginVertical: spacing.sm,
  },
  metrics: { flexDirection: 'row', gap: spacing.sm },
  metric: { flex: 1, alignItems: 'center', gap: spacing.xs },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
    gap: spacing.md,
  },
  emptyIcon: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    padding: spacing.lg,
  },
  runCard: { marginBottom: spacing.md },
  runHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  route: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  routeEmpty: { marginTop: spacing.lg },
});
