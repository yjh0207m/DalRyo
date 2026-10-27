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
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Flame,
  Footprints,
  Route,
  Timer,
  type LucideIcon,
} from 'lucide-react-native';
import Svg, {
  Circle,
  G,
  Path,
  Polyline,
  Rect,
  Text as SvgText,
} from 'react-native-svg';
import {
  FINISH_COLOR,
  START_COLOR,
  labelSides,
  routeSegments,
} from '../../utils/routeMap';
import {
  AppText,
  Badge,
  Button,
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
import { colors, radius, spacing } from '../../theme';
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
        <Card style={styles.section}>
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
            {selectedRuns === null ? (
              <>
                <Card tone="soft">
                  <AppText variant="caption" color={colors.primaryInk}>
                    총 달린 거리
                  </AppText>
                  <View style={styles.distance}>
                    <AppText variant="display" color={colors.primaryInk}>
                      {summary.distanceKm.toFixed(2)}
                    </AppText>
                    <AppText variant="subheading" color={colors.primaryInk}>
                      km
                    </AppText>
                  </View>
                  <AppText variant="caption" color={colors.primaryInk}>
                    {runsByDay.size > 0
                      ? `${runsByDay.size}일 동안 한 걸음씩 쌓았어요`
                      : '첫 기록을 남겨 볼까요?'}
                  </AppText>
                </Card>
                <Card style={styles.section}>
                  <View style={styles.metrics}>
                    <Metric
                      icon={Timer}
                      label="총 시간"
                      value={formatDuration(summary.durationSec)}
                    />
                    <Metric
                      icon={Route}
                      label="평균 페이스"
                      value={
                        summary.distanceKm > 0
                          ? formatPace(summary.paceSec)
                          : '—'
                      }
                      unit="/km"
                    />
                    <Metric
                      icon={Flame}
                      label="총 칼로리"
                      value={String(summary.calories)}
                      unit="kcal"
                    />
                  </View>
                </Card>
                <View style={styles.hint}>
                  <CalendarDays size={18} color={colors.textMuted} />
                  <AppText variant="caption" color={colors.textMuted}>
                    날짜를 누르면 그날의 기록을 볼 수 있어요
                  </AppText>
                </View>
              </>
            ) : selectedRuns.length === 0 ? (
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
              selectedRuns.map(run => (
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

function RunCard({ run, onOpen }: { run: RunDocument; onOpen: () => void }) {
  const startedAt = getRunStartedAtDate(run);
  const points = projectRunRoute(run.route);
  const start = points[0];
  const end = points[points.length - 1];
  // 화면 좌표는 y가 아래로 커지므로 [-y, x]로 넘긴다. 미리보기 단위로 40 이내면 겹친다고 본다
  const sides = labelSides(
    points.map(point => [-point.y, point.x] as [number, number]),
    40,
  );
  return (
    <Card style={styles.runCard}>
      <View style={styles.runHeader}>
        <Badge label={GOAL_LABELS[run.goal_type]} />
        <AppText variant="caption" color={colors.textMuted}>
          {String(startedAt.getHours()).padStart(2, '0')}:
          {String(startedAt.getMinutes()).padStart(2, '0')} 출발
        </AppText>
      </View>
      <View style={styles.distance}>
        <AppText variant="title" color={colors.primaryInk}>
          {run.distance_km.toFixed(2)}
        </AppText>
        <AppText variant="caption" color={colors.textMuted}>
          km
        </AppText>
      </View>
      <View style={styles.metrics}>
        <Metric
          icon={Timer}
          label="시간"
          value={formatDuration(run.duration_sec)}
        />
        <Metric
          icon={Route}
          label="페이스"
          value={run.distance_km > 0 ? formatPace(run.avg_pace_sec) : '—'}
          unit="/km"
        />
        <Metric
          icon={Flame}
          label="칼로리"
          value={String(run.calories)}
          unit="kcal"
        />
      </View>
      {points.length > 1 ? (
        <View
          style={styles.route}
          accessible
          accessibilityLabel="GPS에 기록된 달리기 경로. START에서 출발해 FINISH에 도착했어요."
        >
          <AppText variant="label" color={colors.textMuted}>
            나의 달리기 경로
          </AppText>
          {/* 이름표가 잘리지 않도록 위아래로 여백을 더 둔다 */}
          <Svg width="100%" height={200} viewBox="0 -24 300 208">
            <Polyline
              points={points.map(point => `${point.x},${point.y}`).join(' ')}
              fill="none"
              stroke={colors.surface}
              strokeWidth={9}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {routeSegments(
              points.map(point => [point.x, point.y] as [number, number]),
            ).map((segment, index) => (
              <Polyline
                key={index}
                points={segment.points.map(([x, y]) => `${x},${y}`).join(' ')}
                fill="none"
                stroke={segment.color}
                strokeWidth={5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
            <RouteTag
              x={end.x}
              y={end.y}
              label="FINISH"
              color={FINISH_COLOR}
              below={sides.finish === 'below'}
            />
            <RouteTag
              x={start.x}
              y={start.y}
              label="START"
              color={START_COLOR}
              below={sides.start === 'below'}
            />
          </Svg>
          <AppText variant="label" color={colors.textMuted}>
            지형을 생략한 경로 미리보기 · 지도는 상세에서 볼 수 있어요
          </AppText>
        </View>
      ) : (
        <AppText
          variant="caption"
          color={colors.textMuted}
          style={styles.routeEmpty}
        >
          저장된 GPS 경로가 없어요
        </AppText>
      )}
      <Button
        label="상세·지도·공유"
        size="md"
        variant="secondary"
        onPress={onOpen}
      />
    </Card>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  unit,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <View style={styles.metric}>
      <Icon size={18} color={colors.textMuted} />
      <AppText variant="subheading" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </AppText>
      <AppText variant="label" color={colors.textMuted}>
        {label}
        {unit ? ` · ${unit}` : ''}
      </AppText>
    </View>
  );
}

// 출발·도착 이름표 (지도 화면의 START/FINISH와 같은 모양). 위치 규칙은 labelSides
function RouteTag({
  x,
  y,
  label,
  color,
  below,
}: {
  x: number;
  y: number;
  label: string;
  color: string;
  below: boolean;
}) {
  const width = label.length * 7.4 + 16;
  const height = 18;
  const top = below ? y + 10 : y - 10 - height;
  const tail = below
    ? `M${x - 5} ${y + 10.5} L${x + 5} ${y + 10.5} L${x} ${y + 5} Z`
    : `M${x - 5} ${y - 10.5} L${x + 5} ${y - 10.5} L${x} ${y - 5} Z`;
  return (
    <G>
      <Rect
        x={x - width / 2}
        y={top}
        width={width}
        height={height}
        rx={6}
        fill={color}
      />
      <Path d={tail} fill={color} />
      <SvgText
        x={x}
        y={top + 12.8}
        fontSize={10}
        fontWeight="800"
        fill="#FFFFFF"
        textAnchor="middle"
        letterSpacing={0.4}
      >
        {label}
      </SvgText>
      <Circle
        cx={x}
        cy={y}
        r={4}
        fill={color}
        stroke={colors.surface}
        strokeWidth={2}
      />
    </G>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.xl },
  subtitle: { marginTop: spacing.xs },
  section: { marginTop: spacing.lg },
  monthControls: {
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
