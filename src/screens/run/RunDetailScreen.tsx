import React, { useEffect, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { AppText, Badge, Button, Card, IconButton } from '../../components/ui';
import { RouteMap } from '../../components/maps/RouteMap';
import { ShareStudioScreen } from './ShareStudioScreen';
import type { RunDocument } from '../../types/run.types';
import type { CharacterDocument } from '../../types/character.types';
import { getRunStartedAtDate } from '../../services/run.service';
import { formatDuration, formatPace } from '../../utils/pace';
import { colors, spacing } from '../../theme';

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
        <AppText variant="heading">달리기 상세</AppText>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="subheading">
          {getRunStartedAtDate(run).toLocaleString('ko-KR')}
        </AppText>
        <Card style={styles.stats}>
          <AppText variant="display" color={colors.primaryInk}>
            {run.distance_km.toFixed(2)} km
          </AppText>
          <AppText variant="subheading">
            {formatDuration(run.duration_sec)} ·{' '}
            {run.distance_km > 0 ? formatPace(run.avg_pace_sec) : '—'} /km
          </AppText>
          <AppText>
            {run.calories} kcal · 평균 {run.avg_speed_kmh.toFixed(1)} km/h
          </AppText>
          <Badge label={`획득 EXP ${run.exp_earned}`} />
        </Card>
        <AppText variant="subheading">나의 경로</AppText>
        <RouteMap route={run.route ?? []} />
        <Button
          label="사진·캐릭터와 기록 공유"
          onPress={() => setShare(true)}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: spacing.sm,
  },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 48 },
  stats: { gap: 12 },
});
