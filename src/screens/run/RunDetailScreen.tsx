import React, { useEffect, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, ChevronLeft, Route, Share2 } from 'lucide-react-native';
import { AppText, Badge, Button, Card, IconButton } from '../../components/ui';
import { RouteMap } from '../../components/maps/RouteMap';
import { ShareStudioScreen } from './ShareStudioScreen';
import type { RunDocument } from '../../types/run.types';
import type { CharacterDocument } from '../../types/character.types';
import { getRunStartedAtDate } from '../../services/run.service';
import { formatDuration, formatPace } from '../../utils/pace';
import { colors, fonts, radius } from '../../theme';
import { fetchParkLabel } from '../../services/park.service';

export function RunDetailScreen({
  run,
  character,
  onBack,
}: {
  run: RunDocument;
  character: CharacterDocument | null;
  onBack: () => void;
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
        <AppText variant="heading" style={styles.headerTitle}>
          러닝 저널
        </AppText>
        <IconButton
          icon={Share2}
          variant="plain"
          accessibilityLabel="기록 공유"
          onPress={() => setShare(true)}
        />
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.dateHeading}>
          <AppText style={styles.eyebrow} color={colors.primaryInk}>
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
        <Card style={styles.stats}>
          <View style={styles.distance}>
            <AppText style={styles.distanceNumber} color={colors.primaryInk}>
              {run.distance_km.toFixed(2)}
            </AppText>
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
              평균 {run.avg_speed_kmh.toFixed(1)} km/h
            </AppText>
          </View>
        </Card>
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
          <AppText variant="label" color={colors.textMuted}>
            ROUTE
          </AppText>
        </View>
        <Card padded={false} style={styles.mapCard}>
          <RouteMap route={run.route ?? []} />
        </Card>
        <Button
          icon={Camera}
          label="사진·캐릭터와 기록 공유"
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
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    minHeight: 54,
  },
  headerTitle: { flex: 1, textAlign: 'center' },
  content: { padding: 20, gap: 18, paddingBottom: 40 },
  dateHeading: { gap: 7, paddingVertical: 6 },
  eyebrow: {
    fontFamily: fonts.semibold,
    fontSize: 9,
    lineHeight: 14,
    letterSpacing: 1.6,
  },
  stats: {
    backgroundColor: colors.surface,
    borderWidth: 0,
    padding: 22,
    gap: 18,
  },
  distance: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  distanceNumber: {
    fontFamily: fonts.extrabold,
    fontSize: 58,
    lineHeight: 70,
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
  },
  metrics: { flexDirection: 'row', gap: 12 },
  metric: { flex: 1, gap: 7 },
  rewards: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
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
});
