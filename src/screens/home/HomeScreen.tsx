import React, {useMemo} from 'react';
import {useDialect} from '../../locales/DialectProvider';
import type {Translate} from '../../locales/translate';
import {ScrollView, StyleSheet, View} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {Bell, Check, Flame, Footprints, Mountain, Route, Settings, Snowflake, Timer, type LucideIcon} from 'lucide-react-native';
import {WanderingCharacter} from '../../components/character/WanderingCharacter';
import {ExpBar, LevelBadge, StreakChip} from '../../components/game/Hud';
import {RunningWorld} from '../../components/scene/RunningWorld';
import {AppText, Badge, Button, Card, IconButton} from '../../components/ui';
import {RunRecordsStatus} from '../../components/ui/RunRecordsStatus';
import {useRunRecords} from '../../hooks/useRunRecords';
import {TAB_BAR_HEIGHT} from '../../navigation/BottomTabBar';
import {fetchThisWeekRuns, getRunStartedAtDate} from '../../services/run.service';
import {colors, radius, shadow, spacing} from '../../theme';
import {CHARACTER_STAGE_ORDER, type CharacterDocument, type CharacterStage} from '../../types/character.types';
import type {RunDocument} from '../../types/run.types';
import type {UserDocument} from '../../types/user.types';
import {getDaysSinceRun, getNextStageProgress, getStoneLevel, STAGE_LABELS, type StoneLevel} from '../../utils/exp';

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
const CHARACTER_SIZE = 150;
const WORLD_HEIGHT = 420;
const GROUND_TOP = 0.76;

const STAGE_TITLES: Record<CharacterStage, string> = {
  egg: '알 품는 중',
  baby: '신입 달리너',
  child: '성장하는 달리너',
  runner: '베테랑 러너',
};

function getStoneMessages(t: Translate): Record<Exclude<StoneLevel, 'none'>, {title: string; body: string}> {
  return {
    warn3: {title: t('char.warn3'), body: t('char.warn3Body')},
    warn5: {title: t('char.warn5'), body: t('char.warn5Body')},
    stone: {title: t('char.stone'), body: t('char.stoneBody')},
  };
}

// 홈 = 게임 로비. 위쪽은 캐릭터가 돌아다니는 월드 + 상태(HUD), 아래 패널에 출발 버튼과 오늘 기록
export function HomeScreen({user, character, onRunPress, onNotificationPress, onSettingsPress, hasUnread}: Props) {
  const insets = useSafeAreaInsets();
  const t = useDialect();
  const stoneMessages = getStoneMessages(t);
  const tapLines = [t('home.tap1'), t('home.tap2'), t('home.tap3'), t('home.tap4'), t('home.tap5')];
  const lastRunAtMs = user?.last_run_at?.toMillis() ?? null;
  const {runs: weekRuns, status, retry} = useRunRecords(fetchThisWeekRuns, lastRunAtMs);
  const totalKm = user?.total_km ?? 0;
  const stoneLevel: StoneLevel = user?.is_frozen ? 'stone' : getStoneLevel(getDaysSinceRun(lastRunAtMs));
  const {today, ranDays} = useMemo(() => summarizeWeek(weekRuns), [weekRuns]);
  const todayIndex = (new Date().getDay() + 6) % 7;
  const streak = getWeekStreak(ranDays, todayIndex);
  const worldHeight = WORLD_HEIGHT;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        style={styles.screen}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{paddingBottom: TAB_BAR_HEIGHT + insets.bottom + spacing.xxxl}}
      >
        <View style={{height: worldHeight}}>
          <RunningWorld speedKmh={0} height={worldHeight} groundTop={GROUND_TOP} cloudsTop={0.3}>
            {character && (
              <View style={styles.actorOnGround}>
                <WanderingCharacter
                  type={character.character_type}
                  stage={character.stage}
                  size={CHARACTER_SIZE}
                  areaWidth={340}
                  frozen={stoneLevel === 'stone'}
                  speech={getSpeech({stage: character.stage, stoneLevel, ranToday: today.distanceKm > 0}, t)}
                  tapLines={stoneLevel === 'stone' || character.stage === 'egg' ? [] : tapLines}
                />
              </View>
            )}
          </RunningWorld>

          <View style={[styles.hud, {paddingTop: spacing.sm}]}>
            {character && <PlayerCard character={character} totalKm={totalKm} />}
            <View style={styles.hudActions}>
              <IconButton icon={Bell} dot={hasUnread} accessibilityLabel={hasUnread ? '알림, 안 읽은 알림 있음' : '알림'} size={40} onPress={onNotificationPress} />
              <IconButton icon={Settings} accessibilityLabel="설정" size={40} onPress={onSettingsPress} />
            </View>
          </View>
          <View style={styles.hudChips}>{status === 'success' && <StreakChip days={streak} />}</View>
        </View>

        <View style={styles.panel}>
          <Button label={t('run.startAction')} icon={Footprints} onPress={onRunPress} />

          {stoneLevel !== 'none' && (
            <Card tone={stoneLevel === 'stone' ? 'stone' : 'warm'} style={styles.notice}>
              {stoneLevel === 'stone' ? <Mountain color={colors.textMuted} size={22} /> : <Snowflake color={colors.accentInk} size={22} />}
              <View style={styles.noticeText}>
                <AppText variant="subheading">{stoneMessages[stoneLevel].title}</AppText>
                <AppText variant="caption" color={colors.textMuted}>
                  {stoneMessages[stoneLevel].body}
                </AppText>
              </View>
            </Card>
          )}

          {status !== 'success' ? (
            <Card style={styles.section}>
              <RunRecordsStatus status={status} onRetry={retry} />
            </Card>
          ) : (
            <>
              <Card style={styles.section}>
                <AppText variant="subheading">나의 오늘 기록</AppText>
                <View style={styles.statsRow}>
                  <Stat icon={Route} value={today.distanceKm.toFixed(2)} unit="km" />
                  <View style={styles.divider} />
                  <Stat icon={Timer} value={String(Math.round(today.durationSec / 60))} unit="분" />
                  <View style={styles.divider} />
                  <Stat icon={Flame} value={String(today.calories)} unit="kcal" />
                </View>
              </Card>

              <Card style={styles.section}>
                <View style={styles.sectionHeader}>
                  <AppText variant="subheading">이번 주 활동</AppText>
                  <Badge
                    label={`${Math.min(ranDays.size, WEEKLY_GOAL_DAYS)} / ${WEEKLY_GOAL_DAYS}일 목표`}
                    tone={ranDays.size >= WEEKLY_GOAL_DAYS ? 'brand' : 'neutral'}
                  />
                </View>
                <View style={styles.weekRow}>
                  {WEEK_LABELS.map((day, index) => {
                    const done = ranDays.has(index);
                    const isToday = index === todayIndex;
                    return (
                      <View key={day} style={styles.weekDay}>
                        <AppText variant="label" color={isToday ? colors.primaryInk : colors.textSubtle}>
                          {day}
                        </AppText>
                        <View style={[styles.weekDot, done && styles.weekDotDone, !done && isToday && styles.weekDotToday]}>
                          {done && <Check color={colors.textOnPrimary} size={16} strokeWidth={3} />}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </Card>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// 게임 HUD의 플레이어 카드: 레벨 배지 + 이름·칭호 + 경험치 바(다음 성장 단계까지)
function PlayerCard({character, totalKm}: {character: CharacterDocument; totalKm: number}) {
  const level = CHARACTER_STAGE_ORDER.indexOf(character.stage) + 1;
  const next = getNextStageProgress(character.stage, totalKm);

  return (
    <View style={styles.playerCard}>
      <LevelBadge level={level} />
      <View style={styles.playerText}>
        <View style={styles.playerName}>
          <AppText variant="subheading" numberOfLines={1} style={styles.flexShrink}>
            {character.pet_name}
          </AppText>
          <AppText variant="label" color={colors.textMuted}>
            {STAGE_TITLES[character.stage]}
          </AppText>
        </View>
        <ExpBar value={character.stage === 'egg' ? 0 : next ? next.progress : 1} />
        <AppText variant="label" color={colors.textMuted}>
          {character.stage === 'egg'
            ? '첫 달리기를 하면 부화해요'
            : next
            ? `${STAGE_LABELS[next.next]}까지 ${next.remainingKm.toFixed(1)}km`
            : `최종 단계 · 누적 ${totalKm.toFixed(1)}km`}
        </AppText>
      </View>
    </View>
  );
}

// 상황에 따라 캐릭터가 건네는 말 (사투리 시스템이 붙으면 i18n 키로 바꾼다)
function getSpeech({stage, stoneLevel, ranToday}: {stage: CharacterStage; stoneLevel: StoneLevel; ranToday: boolean}, t: Translate) {
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
  const today = {distanceKm: 0, durationSec: 0, calories: 0};
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

  return {today, ranDays};
}

function Stat({icon: Icon, value, unit}: {icon: LucideIcon; value: string; unit: string}) {
  return (
    <View style={styles.stat}>
      <Icon color={colors.textSubtle} size={18} />
      <AppText variant="number" color={colors.primaryInk}>
        {value}
      </AppText>
      <AppText variant="caption" color={colors.textMuted}>
        {unit}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: colors.sky},
  // 캐릭터 PNG의 발 위치(약 82%)가 땅 윗면에 오도록 끌어올린다
  actorOnGround: {marginTop: -CHARACTER_SIZE * 0.82},
  hud: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  hudActions: {gap: spacing.sm},
  hudChips: {position: 'absolute', top: 96, left: spacing.lg, flexDirection: 'row', gap: spacing.sm},
  playerCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    // Android는 반투명 배경 + 그림자(elevation)면 그림자가 안쪽으로 비쳐 보여 불투명하게 둔다
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  playerText: {flex: 1, gap: 4},
  playerName: {flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm},
  flexShrink: {flexShrink: 1},
  // 월드의 땅 위에 겹쳐 올라오는 아래 패널
  panel: {
    marginTop: -28,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  notice: {flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg, paddingVertical: spacing.lg},
  noticeText: {flex: 1, gap: 2},
  section: {marginTop: spacing.md},
  sectionHeader: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  statsRow: {flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg},
  stat: {flex: 1, alignItems: 'center', gap: 2},
  divider: {width: StyleSheet.hairlineWidth, height: 48, backgroundColor: colors.border},
  weekRow: {flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.lg},
  weekDay: {alignItems: 'center', gap: spacing.sm},
  weekDot: {width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center'},
  weekDotDone: {backgroundColor: colors.primary},
  weekDotToday: {backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.primary},
});
