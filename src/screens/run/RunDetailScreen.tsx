import React, { useEffect, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, ChevronLeft, Route } from 'lucide-react-native';
import {
  AppText,
  Badge,
  Button,
  Card,
  IconButton,
  TallNumber,
} from '../../components/ui';
import { RouteMap } from '../../components/maps/RouteMap';
import { ShareStudioScreen } from './ShareStudioScreen';
import type { RunDocument } from '../../types/run.types';
import type { CharacterDocument } from '../../types/character.types';
import { getRunStartedAtDate } from '../../services/run.service';
import { formatDuration, formatPace } from '../../utils/pace';
import {
  colors,
  fonts,
  radius,
  summaryNumber,
  themedStyles,
} from '../../theme';
import { fetchParkLabel } from '../../services/park.service';

export function RunDetailScreen({
  run,
  character,
  onBack,
  onPosted,
}: {
  run: RunDocument;
  character: CharacterDocument | null;
  onBack: () => void;
  onPosted?: () => void;
}) {
  const [share, setShare] = useState(false);
  const [parkLabel, setParkLabel] = useState<{
    name: string;
    course: string | null;
  } | null>(null);
  useEffect(() => {
    let active = true;
    setParkLabel(null);
    if (run.park_id)
      fetchParkLabel(run.park_id, run.course_id)
        .then(label => {
          if (active) setParkLabel(label);
        })
        .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [run.park_id, run.course_id]);
  useEffect(() => {
    if (share) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack, share]);
  if (share)
    return (
      <ShareStudioScreen
        run={run}
        character={character}
        onBack={() => setShare(false)}
        onPosted={onPosted}
      />
    );
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <IconButton
          icon={ChevronLeft}
          variant="plain"
          accessibilityLabel="기록 상세에서 뒤로"
          onPress={onBack}
        />
        <AppText
          variant="heading"
          accessibilityRole="header"
          style={styles.headerTitle}
        >
          러닝 저널
        </AppText>
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.dateHeading}>
          <AppText style={styles.eyebrow} color={colors.textMuted}>
            A RUN TO REMEMBER
          </AppText>
          <AppText variant="subheading">
            {getRunStartedAtDate(run).toLocaleDateString('ko-KR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              weekday: 'long',
            })}
          </AppText>
          <AppText variant="caption" color={colors.textMuted}>
            {getRunStartedAtDate(run).toLocaleTimeString('ko-KR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
            의 발자국
          </AppText>
        </View>
        {/* 기록 탭의 "이번 달 누적 거리"처럼 화면 양끝까지 채운 하늘색 띠로 받친다 */}
        <View testID="run-detail-stats" style={styles.stats}>
          <View style={styles.distance}>
            {/* 기록 탭 "이번 달 누적 거리"와 같은 키 큰 숫자(theme의 summaryNumber) */}
            <TallNumber
              stretch={summaryNumber.stretch}
              fontSize={summaryNumber.fontSize}
              lineHeight={summaryNumber.lineHeight}
              style={summaryNumber.style}
              color={colors.primaryInk}
              numberOfLines={1}
            >
              {run.distance_km.toFixed(2)}
            </TallNumber>
            <AppText variant="heading" color={colors.primaryInk}>
              km
            </AppText>
          </View>
          <View style={styles.metrics}>
            <DetailMetric
              label="시간"
              value={formatDuration(run.duration_sec)}
            />
            <DetailMetric
              label="평균 페이스"
              value={run.distance_km > 0 ? formatPace(run.avg_pace_sec) : '—'}
            />
            <DetailMetric label="칼로리" value={`${run.calories} kcal`} />
          </View>
          <View style={styles.rewards}>
            <Badge label={`획득 EXP ${run.exp_earned}`} />
            <AppText variant="caption" color={colors.textMuted}>
              평균 속도 {run.avg_speed_kmh.toFixed(1)} km/h
            </AppText>
          </View>
        </View>
        {!!run.park_id && (
          <View style={styles.parkInfo}>
            <Route size={16} color={colors.primaryInk} />
            <View>
              <AppText variant="subheading">
                {parkLabel?.name ?? '공원 달리기'}
              </AppText>
              {!!parkLabel?.course && (
                <AppText variant="caption" color={colors.textMuted}>
                  {parkLabel.course}
                </AppText>
              )}
            </View>
          </View>
        )}
        <View style={styles.mapHeading}>
          <AppText variant="heading">내가 달린 길</AppText>
        </View>
        <Card padded={false} style={styles.mapCard}>
          <RouteMap route={run.route ?? []} />
        </Card>
        <Button
          icon={Camera}
          label="오운완 카드"
          onPress={() => setShare(true)}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <AppText variant="label" color={colors.textMuted}>
        {label}
      </AppText>
      <AppText variant="subheading" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </AppText>
    </View>
  );
}
const styles = themedStyles(() => ({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    minHeight: 54,
  },
  headerTitle: { flex: 1 },
  content: { padding: 20, gap: 18, paddingBottom: 40 },
  dateHeading: { gap: 7, paddingVertical: 6 },
  eyebrow: {
    fontFamily: fonts.semibold,
    fontSize: 9,
    lineHeight: 14,
    letterSpacing: 1.6,
  },
  // 본문 좌우 여백(20)을 상쇄해 화면 양끝까지 닿고, 안쪽 글자는 본문과 같은 선에 맞춘다.
  // 위는 큰 숫자가 띠 윗선에 붙어 보이지 않게 아래보다 넉넉히 둔다(숫자 자체 여백 포함 눈으로 위 35 · 아래 28)
  stats: {
    backgroundColor: colors.secondarySoft,
    marginHorizontal: -20,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 22,
    gap: 18,
  },
  distance: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  metrics: { flexDirection: 'row', gap: 12 },
  metric: { flex: 1, gap: 7 },
  rewards: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    // 하늘색 띠 위에서 회색 선이 탁해 보이지 않게 파랑 테두리 색을 쓴다
    borderTopColor: colors.primaryBorder,
  },
  parkInfo: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  mapHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  mapCard: { overflow: 'hidden', borderRadius: radius.xl, padding: 12 },
}));
