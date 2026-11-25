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
} from 'lucide-react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { FINISH_COLOR, START_COLOR, routeSegments } from '../../utils/routeMap';
import {
  AppText,
  Badge,
  Button,
  Card,
  IconButton,
  ScreenHeader,
  TallNumber,
} from '../../components/ui';
import { SlideScreen } from '../../navigation/slide';
import { RunDetailScreen } from './RunDetailScreen';
import type { CharacterDocument } from '../../types/character.types';
import { RunRecordsStatus } from '../../components/ui/RunRecordsStatus';
import { useRunRecords } from '../../hooks/useRunRecords';
import { TAB_BAR_HEIGHT } from '../../navigation/BottomTabBar';
import {
  fetchMonthlyRuns,
  getRunStartedAtDate,
} from '../../services/run.service';
import {
  colors,
  radius,
  spacing,
  summaryNumber,
  themedStyles,
  typography,
} from '../../theme';
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
  // 기록 상세의 오운완 카드를 피드에 올린 뒤 호출된다
  onPosted?: () => void;
  // 달리기 시작 시트를 연다(이번 달 기록이 없을 때)
  onStartRun?: () => void;
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
  onPosted,
  onStartRun,
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
  // 기록 목록은 그대로 두고 그 위로 상세가 밀려 들어온다
  const list = (
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
            progressBackgroundColor={colors.surfaceRaised}
          />
        }
      >
        <ScreenHeader
          hasUnread={hasUnread}
          title="기록"
          onNotificationPress={onNotificationPress}
          onSettingsPress={onSettingsPress}
        />
        <View style={styles.monthControls}>
          <IconButton
            icon={ChevronLeft}
            variant="plain"
            size={40}
            accessibilityLabel="이전 달"
            onPress={() => moveMonth(-1)}
          />
          <AppText variant="heading">
            {year}년 {month + 1}월
          </AppText>
          <IconButton
            icon={ChevronRight}
            variant="plain"
            size={40}
            accessibilityLabel="다음 달"
            onPress={() => moveMonth(1)}
          />
        </View>
        {status === 'success' && (
          // 카드로 감싸지 않고 화면 양끝까지 채운 띠
          <View testID="record-month-hero" style={styles.monthHero}>
            <View style={styles.monthHeroHeading}>
              <AppText variant="label" color={colors.textMuted}>
                이번 달 누적 거리
              </AppText>
              <Badge label={`${runsByDay.size}일 · ${runs.length}회`} />
            </View>
            <View style={[styles.distance, styles.monthDistanceRow]}>
              {/* 세로로 늘린 키 큰 숫자 */}
              {/* 크기·세로 배율은 기록 상세와 함께 theme의 summaryNumber에서 정한다 */}
              <TallNumber
                stretch={summaryNumber.stretch}
                fontSize={summaryNumber.fontSize}
                lineHeight={summaryNumber.lineHeight}
                style={summaryNumber.style}
                color={colors.primaryInk}
                numberOfLines={1}
              >
                {summary.distanceKm.toFixed(2)}
              </TallNumber>
              <AppText variant="subheading" color={colors.textMuted}>
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
          </View>
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
              style={styles.viewTab}
            >
              <Icon
                size={16}
                color={view === mode ? colors.primaryInk : colors.textMuted}
              />
              <AppText
                variant={view === mode ? 'label' : 'caption'}
                color={view === mode ? colors.primaryInk : colors.textMuted}
              >
                {label}
              </AppText>
              {view === mode && <View style={styles.viewTabIndicator} />}
            </Pressable>
          ))}
        </View>
        {view === 'calendar' && (
          <Card tone="flat" padded={false} style={styles.calendarCard}>
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
          <Card tone="flat" padded={false} style={styles.section}>
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
                }회`}
                tone="neutral"
              />
            </View>
            {(selectedRuns ?? runs).length === 0 ? (
              <Card tone="flat" style={styles.empty}>
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
                {/* 지난 달이 아니라 이번 달을 보고 있을 때만 바로 시작할 수 있게 한다 */}
                {onStartRun && isCurrentMonth && (
                  <Button
                    label="달리기 시작"
                    icon={Footprints}
                    variant="secondary"
                    size="md"
                    onPress={onStartRun}
                  />
                )}
              </Card>
            ) : (
              // 기록 목록은 화면 양끝까지 쓰고 기록 사이는 가는 선으로 나눈다
              <View testID="record-journal-list" style={styles.journalList}>
                {(selectedRuns ?? runs).map(run => (
                  <RunCard
                    key={run.run_id}
                    run={run}
                    onOpen={() => setSelectedRun(run)}
                  />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
  return (
    <View style={styles.screen}>
      <View
        style={styles.screen}
        accessibilityElementsHidden={!!selectedRun}
        importantForAccessibility={selectedRun ? 'no-hide-descendants' : 'auto'}
      >
        {list}
      </View>
      {selectedRun && (
        <SlideScreen
          key={selectedRun.run_id}
          onBack={() => setSelectedRun(null)}
        >
          {back => (
            <RunDetailScreen
              run={selectedRun}
              character={character}
              onBack={back}
              onPosted={onPosted}
            />
          )}
        </SlideScreen>
      )}
    </View>
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
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      {/* 기록 하나를 테두리 있는 카드 한 장으로 묶는다 */}
      <Card padded={false} style={styles.journalCard}>
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
              <AppText
                style={styles.runDistance}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {run.distance_km.toFixed(2)}
              </AppText>
              <AppText variant="caption" color={colors.textMuted}>
                km
              </AppText>
            </View>
            <AppText variant="subheading" color={colors.text}>
              {run.distance_km > 0 && run.avg_pace_sec > 0
                ? `${formatPace(run.avg_pace_sec)} /km`
                : '평균 페이스 —'}
            </AppText>
          </View>
          {points.length > 1 && (
            <View
              style={styles.routeThumb}
              accessible
              accessibilityLabel="GPS 경로 미리보기"
            >
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
            </View>
          )}
        </View>
        <View style={styles.journalStats}>
          <AppText
            variant="caption"
            color={colors.textMuted}
            style={styles.journalMainText}
          >
            {`${String(date.getHours()).padStart(2, '0')}:${String(
              date.getMinutes(),
            ).padStart(2, '0')} · ${formatDuration(run.duration_sec)} 달림 · ${
              run.calories
            } kcal`}
          </AppText>
          <ArrowUpRight size={17} color={colors.primaryInk} />
        </View>
      </Card>
    </Pressable>
  );
}

const styles = themedStyles(() => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: spacing.xl },
  // 본문 좌우 여백(spacing.xl)을 상쇄해 화면 양끝까지 닿고, 안쪽 글자는 본문과 같은 선에 맞춘다
  // 크기는 예전 그대로 두고 위아래와 줄 사이만 넉넉히 띄운다 (위아래 22 → 28, 거리 줄 위아래 8 → 12)
  monthHero: {
    backgroundColor: colors.secondarySoft,
    marginHorizontal: -spacing.xl,
    paddingHorizontal: spacing.xl,
    paddingVertical: 28,
    marginTop: 4,
  },
  monthHeroHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthDistanceRow: { marginVertical: spacing.md },
  monthMetrics: {
    flexDirection: 'row',
    paddingTop: spacing.md,
    marginTop: spacing.xs,
    gap: 12,
  },
  journalMetric: { flex: 1, gap: 6 },
  viewSwitcher: {
    flexDirection: 'row',
    gap: 8,
    marginTop: spacing.xxl,
  },
  viewTab: {
    flex: 1,
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  viewTabIndicator: {
    position: 'absolute',
    bottom: 0,
    width: 28,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.primaryAction,
  },
  calendarCard: { marginTop: spacing.xl },
  // 본문 좌우 여백(spacing.xl)을 상쇄해 화면 양끝까지 닿게 한다. 맨 위에도 선을 긋는다
  journalList: {
    marginHorizontal: -spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  // 기록 한 줄. 상자 대신 화면 너비 전체를 쓰고 아래 선으로 다음 기록과 나눈다. 글자는 본문 선(좌우 20)에 맞춘다
  journalCard: {
    borderRadius: 0,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  journalMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginVertical: spacing.sm,
  },
  journalMainText: { flex: 1 },
  runDistance: {
    ...typography.numberLarge,
    flexShrink: 1,
  },
  routeThumb: {
    width: 96,
    height: 72,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    gap: 5,
  },
  journalStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: spacing.xs,
  },
  section: { marginTop: spacing.lg },
  // 헤더 바로 아래 첫 줄. 부제목이 있던 때의 위쪽 여백(14)은 없앴다
  monthControls: {
    marginTop: 0,
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
  recordedDay: { backgroundColor: colors.secondarySoft },
  selectedDay: {
    backgroundColor: colors.primaryAction,
    borderColor: colors.primaryAction,
  },
  pressed: { opacity: 0.7 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'transparent' },
  recordedDot: { backgroundColor: colors.secondary },
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
    marginTop: spacing.section,
    marginBottom: spacing.lg,
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
    padding: spacing.sm,
  },
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
}));
