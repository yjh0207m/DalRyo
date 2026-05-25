import React, {useEffect, useMemo, useState} from 'react';
import {Image, ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {fetchMonthlyRuns, summarizeRuns} from '../../services/run.service';
import type {RunDocument} from '../../types/run.types';
import {formatDuration, formatPace} from '../../utils/pace';

const images = {
  bgDay: require('../../assets/images/bg-day.png'),
};

const MINT = '#58CFA6';
const TEXT = '#151515';

export function RecordScreen() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [runs, setRuns] = useState<RunDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    setLoading(true);
    fetchMonthlyRuns(year, month)
      .then(result => {
        if (mounted) {
          setRuns(result);
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [month, year]);

  const runsByDay = useMemo(() => {
    const map = new Map<number, RunDocument[]>();

    runs.forEach(run => {
      const date = getRunStartedAt(run);
      const day = date.getDate();
      map.set(day, [...(map.get(day) ?? []), run]);
    });

    return map;
  }, [runs]);

  const selectedRuns = selectedDay ? runsByDay.get(selectedDay) ?? [] : null;
  const summary = summarizeRuns(runs);

  const moveMonth = (delta: number) => {
    const next = new Date(year, month + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
    setSelectedDay(null);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>기록</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity activeOpacity={0.8} style={styles.iconButton}>
            <Text style={styles.iconButtonText}>⚙</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.8} style={styles.iconButton}>
            <Text style={styles.iconButtonText}>⌕</Text>
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.calendarCard}>
          <View style={styles.calendarControls}>
            <TouchableOpacity activeOpacity={0.8} onPress={() => moveMonth(-1)} style={styles.calendarArrow}>
              <Text style={styles.calendarArrowText}>‹</Text>
            </TouchableOpacity>
            <View style={styles.calendarSelect}>
              <Text style={styles.calendarSelectText}>{monthNames[month]}</Text>
              <Text style={styles.calendarSelectArrow}>⌄</Text>
            </View>
            <View style={styles.calendarSelect}>
              <Text style={styles.calendarSelectText}>{year}</Text>
              <Text style={styles.calendarSelectArrow}>⌄</Text>
            </View>
            <TouchableOpacity activeOpacity={0.8} onPress={() => moveMonth(1)} style={styles.calendarArrow}>
              <Text style={styles.calendarArrowText}>›</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.weekHeaderRow}>
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
              <Text key={day} style={styles.weekHeaderText}>{day}</Text>
            ))}
          </View>
          <View style={styles.monthGrid}>
            {buildCalendarCells(year, month).map((day, index) => {
              const hasRun = day !== null && runsByDay.has(day);
              const selected = day !== null && selectedDay === day;

              return (
                <TouchableOpacity
                  activeOpacity={day ? 0.82 : 1}
                  disabled={!day}
                  key={`${day ?? 'blank'}-${index}`}
                  onPress={() => setSelectedDay(day)}
                  style={styles.monthCell}>
                  {!!day && (
                    <View style={[styles.monthDay, hasRun && styles.monthRecordedDay, selected && (hasRun ? styles.monthSelectedRecordedDay : styles.monthSelectedEmptyDay)]}>
                      <Text style={[styles.monthDayText, hasRun && styles.monthRecordedText, selected && styles.monthSelectedText]}>{day}</Text>
                      {hasRun && <View style={[styles.recordDot, selected && styles.recordDotSelected]} />}
                      {selected && !hasRun && <View style={styles.emptySelectedDot} />}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {selectedRuns === null && <AverageRecordCard loading={loading} summary={summary} year={year} month={month} />}
        {selectedRuns !== null && selectedRuns.length > 0 && <RunDetailCard day={selectedDay ?? 1} month={month} runs={selectedRuns} year={year} />}
        {selectedRuns !== null && selectedRuns.length === 0 && <EmptyRecordCard day={selectedDay ?? 1} month={month} year={year} />}
      </ScrollView>
    </View>
  );
}

function AverageRecordCard({loading, summary, year, month}: {loading: boolean; summary: ReturnType<typeof summarizeRuns>; year: number; month: number}) {
  return (
    <View style={styles.detailCard}>
      <Text style={styles.recordTitle}>{year}년 {month + 1}월 평균 기록</Text>
      <View style={styles.averageGrid}>
        <AverageMetric icon="⌖" value={loading ? '-' : summary.averageDistanceKm.toFixed(2)} unit="km" label="평균 거리" />
        <AverageMetric icon="⏱" value={loading ? '-' : formatDuration(summary.averageDurationSec)} label="평균 시간" />
        <AverageMetric icon="⌁" value={loading ? '-' : formatPace(summary.averagePaceSec)} unit="/km" label="평균 페이스" />
        <AverageMetric icon="⌂" value={loading ? '-' : String(summary.averageCalories)} unit="kcal" label="평균 칼로리" />
        <AverageMetric icon="△" value={loading ? '-' : `+${summary.averageElevationM}`} unit="m" label="평균 고도상승" />
        <AverageMetric icon="♡" value={loading ? '-' : String(summary.averageHeartRate)} unit="bpm" label="평균 심박수" />
      </View>
      <View style={styles.selectHintBox}>
        <Text style={styles.selectHintIcon}>▣</Text>
        <View>
          <Text style={styles.selectHintTitle}>날짜를 선택하면</Text>
          <Text style={styles.selectHintText}>해당 날의 상세 기록을 확인할 수 있어요!</Text>
        </View>
      </View>
    </View>
  );
}

function RunDetailCard({day, month, runs, year}: {day: number; month: number; runs: RunDocument[]; year: number}) {
  const total = summarizeRuns(runs);
  const mainRun = runs[0];

  return (
    <View style={styles.detailCard}>
      <Text style={styles.recordTitle}>{year}. {String(month + 1).padStart(2, '0')}. {String(day).padStart(2, '0')} 러닝 기록</Text>
      <View style={styles.distanceHero}>
        <Text style={styles.distanceNumber}>{total.totalDistanceKm.toFixed(1)}</Text>
        <Text style={styles.distanceUnit}>km</Text>
      </View>
      <View style={styles.detailDivider} />
      <View style={styles.runMetricGrid}>
        <RunMetric icon="⌁" value={formatPace(mainRun.avg_pace_sec)} unit="/km" label="평균 페이스" />
        <RunMetric icon="⏱" value={formatDuration(mainRun.duration_sec)} label="시간" />
        <RunMetric icon="⌂" value={String(mainRun.calories)} unit="kcal" label="칼로리" />
        <RunMetric icon="△" value="+0" unit="m" label="고도상승" />
        <RunMetric icon="♡" value={String(mainRun.avg_heart_rate ?? 0)} unit="bpm" label="심박수" />
        <RunMetric icon="⌾" value="0" unit="spm" label="케이던스" />
      </View>
      <View style={styles.routePreview}>
        <Image source={images.bgDay} resizeMode="cover" style={styles.routeMapImage} />
        <View style={[styles.routeLine, styles.routeLineOne]} />
        <View style={[styles.routeLine, styles.routeLineTwo]} />
        <Text style={[styles.routeBadge, styles.routeStart]}>START</Text>
        <Text style={[styles.routeBadge, styles.routeFinish]}>FINISH</Text>
      </View>
    </View>
  );
}

function EmptyRecordCard({day, month, year}: {day: number; month: number; year: number}) {
  return (
    <View style={[styles.detailCard, styles.emptyRecordCard]}>
      <Text style={styles.recordTitle}>{year}. {String(month + 1).padStart(2, '0')}. {String(day).padStart(2, '0')}</Text>
      <Text style={styles.emptyRecordTitle}>이 날은 기록이 없어요</Text>
      <Text style={styles.emptyRecordSubtitle}>새로운 러닝에 도전해보세요!</Text>
    </View>
  );
}

function AverageMetric({icon, value, unit, label}: {icon: string; value: string; unit?: string; label: string}) {
  return (
    <View style={styles.averageMetric}>
      <Text style={styles.averageIcon}>{icon}</Text>
      <Text style={styles.averageValue}>{value} <Text style={styles.averageUnit}>{unit}</Text></Text>
      <Text style={styles.averageLabel}>{label}</Text>
    </View>
  );
}

function RunMetric({icon, value, unit, label}: {icon: string; value: string; unit?: string; label: string}) {
  return (
    <View style={styles.runMetricCard}>
      <Text style={styles.runMetricIcon}>{icon}</Text>
      <View>
        <Text style={styles.runMetricValue}>{value} <Text style={styles.runMetricUnit}>{unit}</Text></Text>
        <Text style={styles.runMetricLabel}>{label}</Text>
      </View>
    </View>
  );
}

function buildCalendarCells(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<number | null> = Array.from({length: firstDay}, () => null);

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(day);
  }

  return cells;
}

function getRunStartedAt(run: RunDocument) {
  const startedAt = run.started_at;

  if (startedAt && typeof startedAt === 'object' && 'toDate' in startedAt && typeof startedAt.toDate === 'function') {
    return startedAt.toDate();
  }

  return new Date();
}

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#F6FEFF'},
  header: {minHeight: 104, paddingHorizontal: 30, paddingTop: 18, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  headerTitle: {color: TEXT, fontSize: 32, fontWeight: '900'},
  headerActions: {flexDirection: 'row', alignItems: 'center', gap: 10},
  iconButton: {width: 46, height: 46, borderRadius: 23, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#9ACAB8', shadowOpacity: 0.16, shadowRadius: 12, shadowOffset: {width: 0, height: 6}, elevation: 5},
  iconButtonText: {color: '#575757', fontSize: 22, fontWeight: '900'},
  content: {paddingHorizontal: 24, paddingBottom: 128},
  calendarCard: {borderRadius: 24, backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 22, borderWidth: 1, borderColor: '#E5EEEE', shadowColor: '#C5E3DA', shadowOpacity: 0.16, shadowRadius: 16, shadowOffset: {width: 0, height: 7}, elevation: 5},
  calendarControls: {flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 22},
  calendarArrow: {width: 34, height: 38, alignItems: 'center', justifyContent: 'center'},
  calendarArrowText: {color: '#0E0E0E', fontSize: 38, lineHeight: 38, fontWeight: '800'},
  calendarSelect: {flex: 1, height: 48, borderRadius: 13, borderWidth: 1, borderColor: '#E0E4E4', backgroundColor: '#FFFFFF', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  calendarSelectText: {color: '#242424', fontSize: 20, fontWeight: '800'},
  calendarSelectArrow: {color: '#111111', fontSize: 22, fontWeight: '900'},
  weekHeaderRow: {flexDirection: 'row', marginBottom: 10},
  weekHeaderText: {width: '14.285%', textAlign: 'center', color: '#9A9A9A', fontSize: 15, fontWeight: '800'},
  monthGrid: {flexDirection: 'row', flexWrap: 'wrap'},
  monthCell: {width: '14.285%', height: 56, alignItems: 'center', justifyContent: 'center'},
  monthDay: {width: 44, height: 48, borderRadius: 13, alignItems: 'center', justifyContent: 'center'},
  monthRecordedDay: {backgroundColor: '#DDF9EE'},
  monthSelectedRecordedDay: {backgroundColor: '#16C47F', shadowColor: '#16C47F', shadowOpacity: 0.28, shadowRadius: 8, shadowOffset: {width: 0, height: 4}, elevation: 5},
  monthSelectedEmptyDay: {backgroundColor: '#2B2B2B'},
  monthDayText: {color: '#171717', fontSize: 20, fontWeight: '700', lineHeight: 24},
  monthRecordedText: {color: '#159E72'},
  monthSelectedText: {color: '#FFFFFF'},
  recordDot: {width: 4, height: 4, borderRadius: 2, backgroundColor: '#15B87C', marginTop: 5},
  recordDotSelected: {backgroundColor: '#FFFFFF'},
  emptySelectedDot: {width: 4, height: 4, borderRadius: 2, backgroundColor: '#FFFFFF', marginTop: 5},
  detailCard: {borderRadius: 24, backgroundColor: '#FFFFFF', padding: 22, marginTop: 10, borderWidth: 1, borderColor: '#E5EEEE', shadowColor: '#C5E3DA', shadowOpacity: 0.14, shadowRadius: 16, shadowOffset: {width: 0, height: 7}, elevation: 5},
  recordTitle: {color: TEXT, fontSize: 19, fontWeight: '900', marginBottom: 18},
  averageGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 12},
  averageMetric: {width: '31%', minHeight: 126, borderRadius: 18, backgroundColor: '#F2FCFA', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8},
  averageIcon: {color: MINT, fontSize: 30, fontWeight: '900', marginBottom: 10},
  averageValue: {color: '#0B0B0B', fontSize: 23, fontWeight: '900'},
  averageUnit: {fontSize: 13, fontWeight: '800'},
  averageLabel: {color: '#686868', fontSize: 13, fontWeight: '800', marginTop: 8, textAlign: 'center'},
  selectHintBox: {minHeight: 76, borderRadius: 18, backgroundColor: '#F7FBFA', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, marginTop: 16},
  selectHintIcon: {color: '#969696', fontSize: 28, fontWeight: '900', marginRight: 16},
  selectHintTitle: {color: '#777777', fontSize: 16, fontWeight: '900'},
  selectHintText: {color: '#777777', fontSize: 15, fontWeight: '700', marginTop: 5},
  distanceHero: {flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', marginTop: -2},
  distanceNumber: {color: '#49BF99', fontSize: 66, lineHeight: 72, fontWeight: '900'},
  distanceUnit: {color: '#000000', fontSize: 28, lineHeight: 42, fontWeight: '900', marginLeft: 7, marginBottom: 8},
  detailDivider: {height: 1, backgroundColor: '#E3EEEE', marginTop: 8, marginBottom: 16},
  runMetricGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 10},
  runMetricCard: {width: '31.4%', minHeight: 86, borderRadius: 16, backgroundColor: '#F1FCFA', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8},
  runMetricIcon: {color: '#6FB59D', fontSize: 27, fontWeight: '900', marginRight: 8},
  runMetricValue: {color: '#070707', fontSize: 20, fontWeight: '900', textAlign: 'center'},
  runMetricUnit: {fontSize: 11, fontWeight: '800'},
  runMetricLabel: {color: '#3C3C3C', fontSize: 12, fontWeight: '800', marginTop: 5, textAlign: 'center'},
  routePreview: {height: 210, borderRadius: 18, overflow: 'hidden', marginTop: 18, backgroundColor: '#E9F3EE'},
  routeMapImage: {position: 'absolute', width: '100%', height: '100%', opacity: 0.36},
  routeLine: {position: 'absolute', height: 8, borderRadius: 5, backgroundColor: '#37BE78'},
  routeLineOne: {left: 88, top: 112, width: 170, transform: [{rotate: '-10deg'}]},
  routeLineTwo: {left: 220, top: 96, width: 180, transform: [{rotate: '9deg'}]},
  routeBadge: {position: 'absolute', overflow: 'hidden', color: '#FFFFFF', fontSize: 12, fontWeight: '900', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 13},
  routeStart: {left: 44, top: 88, backgroundColor: '#47BC8A'},
  routeFinish: {right: 38, top: 104, backgroundColor: '#FF6B4B'},
  emptyRecordCard: {minHeight: 372},
  emptyRecordTitle: {color: '#0F0F0F', fontSize: 25, fontWeight: '900', textAlign: 'center', marginTop: 16},
  emptyRecordSubtitle: {color: '#8A8A8A', fontSize: 17, fontWeight: '800', textAlign: 'center', marginTop: 14},
});
