import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {
  ArrowUpRight,
  Bell,
  Check,
  Footprints,
  Mountain,
  Settings,
  Snowflake,
} from 'lucide-react-native';
import { useDialect } from '../../locales/DialectProvider';
import type { Translate } from '../../locales/translate';
import { LobbyCharacter } from '../../components/character/LobbyCharacter';
import { CompanionScene } from '../../components/scene/CompanionScene';
import { ExpBar, StreakChip } from '../../components/game/Hud';
import { AppText, Badge, Button, Card, IconButton } from '../../components/ui';
import { RunRecordsStatus } from '../../components/ui/RunRecordsStatus';
import { useRunRecords } from '../../hooks/useRunRecords';
import { TAB_BAR_HEIGHT } from '../../navigation/BottomTabBar';
import {
  fetchThisWeekRuns,
  getRunStartedAtDate,
} from '../../services/run.service';
import { colors, fonts, radius, spacing } from '../../theme';
import {
  CHARACTER_STAGE_ORDER,
  type CharacterDocument,
  type CharacterStage,
} from '../../types/character.types';
import type { RunDocument } from '../../types/run.types';
import type { UserDocument } from '../../types/user.types';
import {
  getDaysSinceRun,
  getNextStageProgress,
  getStoneLevel,
  STAGE_LABELS,
  type StoneLevel,
} from '../../utils/exp';
type Props = {
  user: UserDocument | null;
  character: CharacterDocument | null;
  onRunPress: () => void;
  hasUnread?: boolean;
  onNotificationPress: () => void;
  onSettingsPress: () => void;
};
const WEEK_LABELS = ['월', '화', '수', '목', '금', '토', '일'];
const WEEKLY_GOAL_DAYS = 5;

export function HomeScreen({
  user,
  character,
  onRunPress,
  onNotificationPress,
  onSettingsPress,
  hasUnread,
}: Props) {
  const insets = useSafeAreaInsets(),
    t = useDialect();
  const lastRunAtMs = user?.last_run_at?.toMillis() ?? null;
  const {
    runs: weekRuns,
    status,
    retry,
  } = useRunRecords(fetchThisWeekRuns, lastRunAtMs);
  const totalKm = user?.total_km ?? 0;
  const stoneLevel: StoneLevel = user?.is_frozen
    ? 'stone'
    : getStoneLevel(getDaysSinceRun(lastRunAtMs));
  const { today, ranDays } = useMemo(() => summarizeWeek(weekRuns), [weekRuns]);
  const todayIndex = (new Date().getDay() + 6) % 7;
  const streak = getWeekStreak(ranDays, todayIndex);
  const next = character
    ? getNextStageProgress(character.stage, totalKm)
    : null;
  const now = new Date();
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: TAB_BAR_HEIGHT + insets.bottom + spacing.xxl },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.brand}>
            <View style={styles.brandMark}>
              <Footprints color={colors.textOnPrimary} size={19} />
            </View>
            <AppText style={styles.wordmark}>달료</AppText>
          </View>
          <View style={styles.headerActions}>
            <IconButton
              icon={Bell}
              dot={hasUnread}
              size={40}
              accessibilityLabel={
                hasUnread ? '알림, 안 읽은 알림 있음' : '알림'
              }
              onPress={onNotificationPress}
            />
            <IconButton
              icon={Settings}
              size={40}
              accessibilityLabel="설정"
              onPress={onSettingsPress}
            />
          </View>
        </View>
        <View style={styles.intro}>
          <AppText variant="title" style={styles.headline}>
            오늘도, 한 걸음 더.
          </AppText>
          <AppText variant="caption" color={colors.textMuted}>
            {user?.display_name ?? '달리너'}님, 나만의 속도로 함께 달려요.
          </AppText>
        </View>
        {character && (
          <>
            <Card padded={false} style={styles.companion}>
              <CompanionScene>
                <LobbyCharacter
                  type={character.character_type}
                  stage={character.stage}
                  size={185}
                  bubblePlacement="beside"
                  frozen={stoneLevel === 'stone'}
                  equipped={character.equipped}
                  tapLines={
                    stoneLevel === 'stone' || character.stage === 'egg'
                      ? []
                      : [t('home.tap1'), t('home.tap2'), t('home.tap3')]
                  }
                />
              </CompanionScene>
              <View pointerEvents="none" style={styles.companionHeader}>
                <View>
                  <AppText style={styles.eyebrow} color={colors.primaryInk}>
                    RUNNING MATE
                  </AppText>
                  <AppText variant="heading">{character.pet_name}</AppText>
                </View>
                <View style={styles.level}>
                  <AppText variant="label" color={colors.primaryInk}>
                    LV.{' '}
                    {String(
                      CHARACTER_STAGE_ORDER.indexOf(character.stage) + 1,
                    ).padStart(2, '0')}
                  </AppText>
                </View>
              </View>
              <View style={styles.companionFooter}>
                <View style={styles.sectionHeader}>
                  <AppText
                    variant="caption"
                    color={colors.text}
                    style={styles.heroQuote}
                    numberOfLines={2}
                  >
                    {getSpeech(
                      {
                        stage: character.stage,
                        stoneLevel,
                        ranToday: today.distanceKm > 0,
                      },
                      t,
                    )}
                  </AppText>
                  <AppText variant="label" color={colors.textMuted}>
                    {totalKm.toFixed(1)} km
                  </AppText>
                </View>
                <ExpBar
                  height={4}
                  value={
                    character.stage === 'egg' ? 0 : next ? next.progress : 1
                  }
                />
                <AppText variant="label" color={colors.textMuted}>
                  {character.stage === 'egg'
                    ? '첫 달리기를 하면 부화해요'
                    : next
                    ? `${
                        STAGE_LABELS[next.next]
                      }까지 ${next.remainingKm.toFixed(1)}km`
                    : '함께 완성한 멋진 달리너'}
                </AppText>
              </View>
            </Card>
          </>
        )}
        <Button
          label={t('run.startAction')}
          icon={Footprints}
          trailingIcon={ArrowUpRight}
          onPress={onRunPress}
          style={styles.start}
        />
        {stoneLevel !== 'none' && (
          <Card
            tone={stoneLevel === 'stone' ? 'stone' : 'warm'}
            style={styles.notice}
          >
            {stoneLevel === 'stone' ? (
              <Mountain color={colors.textMuted} size={22} />
            ) : (
              <Snowflake color={colors.accentInk} size={22} />
            )}
            <View style={styles.flex}>
              <AppText variant="subheading">
                {t(
                  stoneLevel === 'stone'
                    ? 'char.stone'
                    : stoneLevel === 'warn3'
                    ? 'char.warn3'
                    : 'char.warn5',
                )}
              </AppText>
              <AppText variant="caption" color={colors.textMuted}>
                {t(
                  stoneLevel === 'stone'
                    ? 'char.stoneBody'
                    : stoneLevel === 'warn3'
                    ? 'char.warn3Body'
                    : 'char.warn5Body',
                )}
              </AppText>
            </View>
          </Card>
        )}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <AppText variant="subheading">오늘의 러닝</AppText>
            <AppText variant="label" color={colors.textMuted}>
              {now.getMonth() + 1}.{String(now.getDate()).padStart(2, '0')}{' '}
              {WEEK_LABELS[todayIndex]}
            </AppText>
          </View>
          {status !== 'success' ? (
            <Card>
              <RunRecordsStatus status={status} onRetry={retry} />
            </Card>
          ) : (
            <View style={styles.todayCard}>
              <View style={styles.distanceMetric}>
                <AppText variant="label" color={colors.textMuted}>
                  달린 거리
                </AppText>
                <View style={styles.valueRow}>
                  <AppText style={styles.distance} color={colors.primaryInk}>
                    {today.distanceKm.toFixed(2)}
                  </AppText>
                  <AppText variant="caption" color={colors.textMuted}>
                    km
                  </AppText>
                </View>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.smallMetric}>
                <AppText variant="label" color={colors.textMuted}>
                  시간
                </AppText>
                <AppText variant="number" color={colors.text}>
                  {Math.round(today.durationSec / 60)}
                </AppText>
                <AppText variant="label" color={colors.textMuted}>
                  min
                </AppText>
              </View>
              <View style={styles.smallMetric}>
                <AppText variant="label" color={colors.textMuted}>
                  칼로리
                </AppText>
                <AppText variant="number" color={colors.text}>
                  {today.calories}
                </AppText>
                <AppText variant="label" color={colors.textMuted}>
                  kcal
                </AppText>
              </View>
            </View>
          )}
        </View>
        {status === 'success' && (
          <Card style={styles.section}>
            <View style={styles.sectionHeader}>
              <AppText variant="subheading">이번 주의 발자국</AppText>
              <Badge
                label={`${Math.min(
                  ranDays.size,
                  WEEKLY_GOAL_DAYS,
                )} / ${WEEKLY_GOAL_DAYS}일`}
              />
            </View>
            <View style={styles.weekRow}>
              {WEEK_LABELS.map((day, index) => {
                const done = ranDays.has(index),
                  isToday = index === todayIndex;
                return (
                  <View key={day} style={styles.weekDay}>
                    <AppText
                      variant="label"
                      color={isToday ? colors.primaryInk : colors.textMuted}
                    >
                      {day}
                    </AppText>
                    <View
                      style={[
                        styles.weekDot,
                        done && styles.weekDotDone,
                        !done && isToday && styles.weekDotToday,
                      ]}
                    >
                      {done ? (
                        <Check
                          color={colors.surface}
                          size={16}
                          strokeWidth={2.5}
                        />
                      ) : isToday ? (
                        <View style={styles.todayDot} />
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
            {streak > 0 && (
              <View style={styles.streak}>
                <StreakChip days={streak} />
              </View>
            )}
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function getSpeech(
  {
    stage,
    stoneLevel,
    ranToday,
  }: { stage: CharacterStage; stoneLevel: StoneLevel; ranToday: boolean },
  t: Translate,
) {
  if (stoneLevel === 'stone') return t('home.stone');
  if (stoneLevel !== 'none') return t('home.warning');
  if (stage === 'egg') return t('home.egg');
  if (ranToday) return t('home.ranToday');
  return t('home.hello');
}

// 이번 주 안에서 오늘(오늘 안 달렸으면 어제)부터 거슬러 올라간 연속 달린 날 수
function getWeekStreak(ranDays: Set<number>, todayIndex: number) {
  let day = ranDays.has(todayIndex) ? todayIndex : todayIndex - 1;
  let streak = 0;
  while (day >= 0 && ranDays.has(day)) {
    streak += 1;
    day -= 1;
  }
  return streak;
}

function summarizeWeek(runs: RunDocument[]) {
  const now = new Date();
  const today = { distanceKm: 0, durationSec: 0, calories: 0 };
  const ranDays = new Set<number>();

  runs.forEach(run => {
    const startedAt = getRunStartedAtDate(run);
    ranDays.add((startedAt.getDay() + 6) % 7);

    if (startedAt.toDateString() === now.toDateString()) {
      today.distanceKm += run.distance_km;
      today.durationSec += run.duration_sec;
      today.calories += run.calories;
    }
  });

  return { today, ranDays };
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  header: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandMark: {
    width: 31,
    height: 31,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    fontFamily: fonts.extrabold,
    fontSize: 25,
    lineHeight: 32,
    letterSpacing: -1.2,
  },
  headerActions: { flexDirection: 'row', gap: 8 },
  intro: { marginTop: 22, marginBottom: 20, gap: 5 },
  headline: { fontSize: 29, lineHeight: 38, letterSpacing: -0.9 },
  companion: { overflow: 'hidden', borderRadius: radius.xl, borderWidth: 0 },
  companionHeader: {
    position: 'absolute',
    left: 18,
    right: 18,
    top: 17,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  eyebrow: {
    fontFamily: fonts.semibold,
    fontSize: 9,
    lineHeight: 15,
    letterSpacing: 1.5,
  },
  level: {
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  companionFooter: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 9,
    backgroundColor: colors.surface,
  },
  start: { marginTop: 16 },
  section: { marginTop: 24 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  todayCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  distanceMetric: { flex: 1.4, gap: 6 },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  heroQuote: { flex: 1 },
  distance: {
    flexShrink: 1,
    fontFamily: fonts.bold,
    fontSize: 34,
    lineHeight: 42,
    letterSpacing: -1.2,
    fontVariant: ['tabular-nums'],
  },
  smallMetric: { flex: 0.8, gap: 3 },
  metricDivider: {
    height: 50,
    width: 1,
    backgroundColor: 'rgba(16,119,94,0.12)',
  },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  weekDay: { alignItems: 'center', gap: 10 },
  weekDot: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekDotDone: { backgroundColor: colors.primary },
  weekDotToday: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  todayDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  streak: { marginTop: 12, alignSelf: 'flex-start' },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
  },
  flex: { flex: 1 },
});
