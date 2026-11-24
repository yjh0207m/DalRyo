import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { AppText, BottomSheet, Button, IconButton } from '../../components/ui';
import { useRunRecords } from '../../hooks/useRunRecords';
import {
  fetchMonthlyRuns,
  getRunStartedAtDate,
} from '../../services/run.service';
import { colors, radius, spacing, themedStyles } from '../../theme';
import type { RunDocument } from '../../types/run.types';
import { formatDuration, formatPace } from '../../utils/pace';
import { buildCalendarCells } from '../../utils/runRecords';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

// 게시물에 붙일 달리기 기록을 고르는 시트. 캘린더에서 날짜를 고르면 그날 기록이 나오고, 하나를 누르면 고른 채로 닫힌다
export function RunPickerSheet({
  selectedId,
  onPick,
  onClose,
}: {
  selectedId?: string | null;
  onPick: (run: RunDocument) => void;
  onClose: () => void;
}) {
  const now = useMemo(() => new Date(), []);
  const [period, setPeriod] = useState({
    year: now.getFullYear(),
    month: now.getMonth(),
  });
  const [day, setDay] = useState<number | null>(null);
  const { year, month } = period;
  const load = useCallback(() => fetchMonthlyRuns(year, month), [year, month]);
  const { runs, status, retry } = useRunRecords(load);
  const runsByDay = useMemo(() => {
    const grouped = new Map<number, RunDocument[]>();
    runs.forEach(run => {
      const date = getRunStartedAtDate(run).getDate();
      grouped.set(date, [...(grouped.get(date) ?? []), run]);
    });
    // 하루 안에서는 먼저 달린 기록부터
    grouped.forEach(list =>
      list.sort(
        (a, b) =>
          getRunStartedAtDate(a).getTime() - getRunStartedAtDate(b).getTime(),
      ),
    );
    return grouped;
  }, [runs]);
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const moveMonth = (delta: number) => {
    const date = new Date(year, month + delta, 1);
    setDay(null);
    setPeriod({ year: date.getFullYear(), month: date.getMonth() });
  };
  const dayRuns = day === null ? [] : runsByDay.get(day) ?? [];
  return (
    <BottomSheet
      title="달리기 기록 첨부"
      testID="run-picker-sheet"
      onClose={onClose}
    >
      {close => (
        <>
          <View style={styles.monthRow}>
            <IconButton
              icon={ChevronLeft}
              accessibilityLabel="이전 달"
              onPress={() => moveMonth(-1)}
            />
            <AppText variant="subheading" accessibilityRole="header">
              {`${year}년 ${month + 1}월`}
            </AppText>
            {/* 아직 오지 않은 달로는 넘어가지 않는다 */}
            <IconButton
              icon={ChevronRight}
              accessibilityLabel="다음 달"
              disabled={isCurrentMonth}
              onPress={() => moveMonth(1)}
            />
          </View>
          {/* 한 주씩 줄을 나누고 칸은 똑같이 나눠 갖는다(퍼센트 폭은 반올림 때문에 일곱째 칸이 넘칠 수 있다) */}
          <View style={styles.week}>
            {WEEKDAYS.map(name => (
              <AppText
                key={name}
                variant="label"
                align="center"
                color={colors.textMuted}
                style={styles.weekday}
              >
                {name}
              </AppText>
            ))}
          </View>
          {weeks(buildCalendarCells(year, month)).map((week, row) => (
            <View key={row} style={styles.week}>
              {week.map((date, index) => {
                const hasRun = date !== null && runsByDay.has(date);
                const selected = date !== null && date === day;
                const future =
                  date !== null && isCurrentMonth && date > now.getDate();
                return (
                  <View key={index} style={styles.cell}>
                    {date !== null && (
                      <Pressable
                        testID={`run-picker-day-${date}`}
                        accessibilityRole="button"
                        accessibilityLabel={`${month + 1}월 ${date}일${
                          hasRun ? ', 달리기 기록 있음' : ''
                        }`}
                        accessibilityState={{
                          selected,
                          disabled: status !== 'success' || future,
                        }}
                        disabled={status !== 'success' || future}
                        onPress={() => setDay(selected ? null : date)}
                        style={({ pressed }) => [
                          styles.day,
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
                              : future
                              ? colors.textSubtle
                              : hasRun
                              ? colors.primaryInk
                              : colors.text
                          }
                        >
                          {date}
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
          ))}
          <View style={styles.runs}>
            {status === 'loading' ? (
              <ActivityIndicator
                color={colors.primary}
                style={styles.loading}
              />
            ) : status === 'error' ? (
              <View style={styles.message}>
                <AppText color={colors.danger} align="center">
                  기록을 불러오지 못했어요.
                </AppText>
                <Button
                  label="다시 시도"
                  size="md"
                  variant="secondary"
                  onPress={retry}
                />
              </View>
            ) : day === null ? (
              <AppText
                color={colors.textMuted}
                align="center"
                style={styles.message}
              >
                {runs.length > 0
                  ? '날짜를 고르면 그날 달린 기록이 나와요.'
                  : '이 달에는 달린 기록이 없어요.'}
              </AppText>
            ) : dayRuns.length === 0 ? (
              <AppText
                color={colors.textMuted}
                align="center"
                style={styles.message}
              >
                {`${month + 1}월 ${day}일에는 달린 기록이 없어요.`}
              </AppText>
            ) : (
              dayRuns.map(run => {
                const chosen = run.run_id === selectedId;
                return (
                  <Pressable
                    key={run.run_id}
                    testID={`run-picker-run-${run.run_id}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: chosen }}
                    accessibilityLabel={`${runTime(
                      run,
                    )}, ${run.distance_km.toFixed(2)}킬로미터 기록 첨부`}
                    onPress={() => close(() => onPick(run))}
                    style={({ pressed }) => [
                      styles.run,
                      chosen && styles.chosenRun,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.runText}>
                      <AppText variant="caption" color={colors.textMuted}>
                        {runTime(run)}
                      </AppText>
                      <AppText variant="subheading">
                        {`${run.distance_km.toFixed(2)}km`}
                      </AppText>
                      <AppText variant="caption" color={colors.textMuted}>
                        {[
                          formatDuration(run.duration_sec),
                          run.avg_pace_sec > 0
                            ? `${formatPace(run.avg_pace_sec)} /km`
                            : '',
                          `${run.calories} kcal`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </AppText>
                    </View>
                    {chosen && <Check size={20} color={colors.primaryInk} />}
                  </Pressable>
                );
              })
            )}
          </View>
        </>
      )}
    </BottomSheet>
  );
}

// 달력 칸을 일곱 칸씩 끊는다. 마지막 주는 빈칸으로 채운다
function weeks(cells: Array<number | null>) {
  const rows: Array<Array<number | null>> = [];
  for (let i = 0; i < cells.length; i += 7) {
    const row = cells.slice(i, i + 7);
    while (row.length < 7) row.push(null);
    rows.push(row);
  }
  return rows;
}

// "13:53"처럼 달리기를 시작한 시각. 기록 화면과 같은 24시간 표기다
export function runTime(run: RunDocument) {
  const started = getRunStartedAtDate(run);
  return `${String(started.getHours()).padStart(2, '0')}:${String(
    started.getMinutes(),
  ).padStart(2, '0')}`;
}
// "11월 6일 (금)"처럼 달린 날
export function runDay(run: RunDocument) {
  const started = getRunStartedAtDate(run);
  return `${started.getMonth() + 1}월 ${started.getDate()}일 (${
    WEEKDAYS[started.getDay()]
  })`;
}

const styles = themedStyles(() => ({
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  week: { flexDirection: 'row' },
  weekday: { flex: 1, paddingBottom: spacing.sm },
  cell: {
    flex: 1,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  day: {
    width: 38,
    height: 42,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  recordedDay: { backgroundColor: colors.primarySoft },
  selectedDay: { backgroundColor: colors.primaryAction },
  pressed: { opacity: 0.7 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'transparent' },
  recordedDot: { backgroundColor: colors.primary },
  selectedDot: { backgroundColor: colors.textOnPrimary },
  runs: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  loading: { marginVertical: spacing.xl },
  message: { marginVertical: spacing.lg, gap: spacing.md },
  run: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chosenRun: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  runText: { flex: 1, gap: 2 },
}));
