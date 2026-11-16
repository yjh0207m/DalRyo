import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {
  Bell,
  Check,
  DoorOpen,
  Footprints,
  Mountain,
  Package,
  ScrollText,
  Settings,
  Snowflake,
  type LucideIcon,
} from 'lucide-react-native';
import { useDialect } from '../../locales/DialectProvider';
import { LobbyCharacter } from '../../components/character/LobbyCharacter';
import { CompanionScene } from '../../components/scene/CompanionScene';
import { StreakChip } from '../../components/game/Hud';
import {
  AppText,
  Badge,
  Card,
  IconButton,
  ProgressBar,
} from '../../components/ui';
import { RunRecordsStatus } from '../../components/ui/RunRecordsStatus';
import { useRunRecords } from '../../hooks/useRunRecords';
import { TAB_BAR_HEIGHT } from '../../navigation/BottomTabBar';
import {
  fetchThisWeekRuns,
  getRunStartedAtDate,
} from '../../services/run.service';
import { colors, fonts, radius, spacing } from '../../theme';
import { formatDuration } from '../../utils/pace';
import {
  CHARACTER_STAGE_ORDER,
  type CharacterDocument,
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
  hasUnread?: boolean;
  onNotificationPress: () => void;
  onSettingsPress: () => void;
  // 아이템(꾸미기·보관함)을 연다. 마이룸·퀘스트는 아직 준비 중이라 눌러도 안내만 나온다
  onItemsPress?: () => void;
  onMyRoomPress?: () => void;
  onQuestPress?: () => void;
  // 캐릭터가 그려지고 이번 주 기록을 불러와, 화면이 다 채워졌을 때 한 번 알린다. 앱을 켤 때 로딩 화면을 이때 걷는다
  onReady?: () => void;
};
const WEEK_LABELS = ['월', '화', '수', '목', '금', '토', '일'];
// 이번 주(월~일) 7일 중 달린 날 수를 보여 준다
const WEEKLY_GOAL_DAYS = 7;

export function HomeScreen({
  user,
  character,
  onNotificationPress,
  onSettingsPress,
  onItemsPress,
  onMyRoomPress,
  onQuestPress,
  hasUnread,
  onReady,
}: Props) {
  const insets = useSafeAreaInsets(),
    t = useDialect();
  const compact = useWindowDimensions().width <= 360;
  const lastRunAtMs = user?.last_run_at?.toMillis() ?? null;
  const {
    runs: weekRuns,
    status,
    retry,
  } = useRunRecords(fetchThisWeekRuns, lastRunAtMs);
  const [characterDrawn, setCharacterDrawn] = useState(false);
  const filled = (!character || characterDrawn) && status !== 'loading';
  const notifyReady = useRef(onReady);
  notifyReady.current = onReady;
  useEffect(() => {
    if (filled) notifyReady.current?.();
  }, [filled]);
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
        {character && (
          <>
            <Card padded={false} style={styles.companion}>
              <CompanionScene height={compact ? 218 : undefined}>
                <LobbyCharacter
                  type={character.character_type}
                  stage={character.stage}
                  size={compact ? 170 : 185}
                  bubblePlacement="beside"
                  onReady={() => setCharacterDrawn(true)}
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
                <AppText
                  variant="title"
                  numberOfLines={1}
                  style={styles.petName}
                >
                  {character.pet_name}
                </AppText>
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
                <View style={styles.progressRow}>
                  <AppText variant="label" color={colors.textMuted}>
                    현재 {totalKm.toFixed(1)}km
                  </AppText>
                  <AppText
                    variant="subheading"
                    color={colors.primaryInk}
                    style={styles.progressLabel}
                  >
                    {character.stage === 'egg'
                      ? '첫 달리기를 하면 부화해요'
                      : next
                      ? `${
                          STAGE_LABELS[next.next]
                        }까지 ${next.remainingKm.toFixed(1)}km`
                      : '함께 완성한 멋진 달리너'}
                  </AppText>
                </View>
                <ProgressBar
                  height={5}
                  trackColor={colors.primaryBorder}
                  value={
                    character.stage === 'egg' ? 0 : next ? next.progress : 1
                  }
                />
              </View>
            </Card>
            <View style={styles.shortcuts}>
              <Shortcut icon={Package} label="아이템" onPress={onItemsPress} />
              <Shortcut
                icon={DoorOpen}
                label="마이룸"
                onPress={onMyRoomPress}
              />
              <Shortcut
                icon={ScrollText}
                label="퀘스트"
                onPress={onQuestPress}
              />
            </View>
          </>
        )}
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
            <AppText variant="heading">오늘의 러닝</AppText>
            <AppText variant="label" color={colors.textMuted}>
              {now.getMonth() + 1}.{String(now.getDate()).padStart(2, '0')}{' '}
              {WEEK_LABELS[todayIndex]}
            </AppText>
          </View>
          {status !== 'success' ? (
            <Card tone="flat" padded={false}>
              <RunRecordsStatus status={status} onRetry={retry} />
            </Card>
          ) : (
            <View style={styles.todayCard}>
              <View style={styles.distanceMetric}>
                <AppText variant="label" color={colors.textMuted}>
                  달린 거리
                </AppText>
                <View style={styles.valueRow}>
                  <AppText
                    style={styles.distance}
                    color={colors.primaryInk}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {today.distanceKm.toFixed(2)}
                  </AppText>
                  <AppText variant="caption" color={colors.textMuted}>
                    km
                  </AppText>
                </View>
              </View>
              <View style={styles.smallMetric}>
                <AppText variant="label" color={colors.textMuted}>
                  시간
                </AppText>
                <AppText
                  variant="subheading"
                  style={styles.summaryNumber}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {formatDuration(today.durationSec)}
                </AppText>
                <AppText variant="label" color={colors.textMuted}>
                  분:초
                </AppText>
              </View>
              <View style={styles.smallMetric}>
                <AppText variant="label" color={colors.textMuted}>
                  칼로리
                </AppText>
                <AppText
                  variant="subheading"
                  style={styles.summaryNumber}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
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
          <Card tone="flat" padded={false} style={styles.weekSection}>
            <View style={styles.sectionHeader}>
              <AppText variant="heading">이번 주의 발자국</AppText>
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

// 캐릭터 카드 아래 정사각형 바로가기. 연결된 화면이 없으면 '준비 중' 안내만 보여 준다
function Shortcut({
  icon: Icon,
  label,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  onPress?: () => void;
}) {
  const ready = !!onPress;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={ready ? label : `${label}, 준비 중`}
      onPress={
        onPress ??
        (() => Alert.alert(label, '준비 중이에요. 조금만 기다려 주세요.'))
      }
      style={({ pressed }) => [
        styles.shortcut,
        pressed && styles.shortcutPressed,
      ]}
    >
      <Icon
        color={ready ? colors.primaryInk : colors.textMuted}
        size={23}
        strokeWidth={1.9}
      />
      <AppText variant="caption" color={ready ? colors.text : colors.textMuted}>
        {label}
      </AppText>
      {!ready && (
        <AppText variant="label" color={colors.textMuted}>
          준비 중
        </AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
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
  companion: {
    marginTop: spacing.lg,
    overflow: 'hidden',
    borderRadius: radius.xl,
    borderWidth: 0,
  },
  companionHeader: {
    position: 'absolute',
    left: 18,
    right: 18,
    top: 17,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  petName: { flex: 1 },
  level: {
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  companionFooter: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 14,
    gap: 9,
    backgroundColor: colors.surfaceMuted,
  },
  shortcuts: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  shortcut: {
    flex: 1,
    minHeight: 76,
    alignItems: 'center',
    paddingTop: spacing.sm,
    gap: 6,
  },
  shortcutPressed: { backgroundColor: colors.surfaceMuted },
  section: { marginTop: 24 },
  weekSection: { marginTop: spacing.lg },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  todayCard: {
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  distanceMetric: { flex: 1.4, gap: 6 },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  progressLabel: { flex: 1, textAlign: 'right' },
  distance: {
    flexShrink: 1,
    fontFamily: fonts.bold,
    fontSize: 38,
    lineHeight: 46,
    letterSpacing: -1.2,
    fontVariant: ['tabular-nums'],
  },
  smallMetric: { flex: 0.8, gap: 3 },
  summaryNumber: {
    fontSize: 21,
    lineHeight: 26,
    fontVariant: ['tabular-nums'],
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
