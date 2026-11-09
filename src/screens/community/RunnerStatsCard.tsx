import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ChevronUp, Footprints, Lock } from 'lucide-react-native';
import { AppText, Card, ProgressBar } from '../../components/ui';
import { LobbyCharacter } from '../../components/character/LobbyCharacter';
import { ExpBar } from '../../components/game/Hud';
import { CompanionScene } from '../../components/scene/CompanionScene';
import type { RunnerProfile } from '../../services/social.service';
import { colors, radius, spacing } from '../../theme';
import {
  CHARACTER_STAGE_ORDER,
  CHARACTER_TYPES,
} from '../../types/character.types';
import { getNextStageProgress, STAGE_LABELS, STAT_MAX } from '../../utils/exp';
import { formatDuration, formatPace } from '../../utils/pace';

const SCENE_HEIGHT = 226;
const CHARACTER_SIZE = 178;
const STATS = [
  ['체력', 'stat_stamina'],
  ['속도', 'stat_speed'],
  ['지구력', 'stat_endurance'],
] as const;

// 러너 프로필의 캐릭터 구역. 홈 화면의 "러닝 메이트" 카드와 같은 모양이다.
// 위쪽은 같은 초원 장면 위에 캐릭터(입고 있는 꾸미기 아이템 포함), 아래쪽은 흰 영역에 경험치·스탯·완료한 러닝을 둔다.
// "완료한 러닝" 줄을 누르면 최근 러닝이 말풍선으로 뜨고, 거기서 전체 기록으로 들어갈 수 있다.
// 러닝 기록을 비공개로 한 러너는 잠금 표시만 보인다.
export function RunnerStatsCard({
  runner,
  runsOpen,
  onToggleRuns,
  onOpenRuns,
}: {
  runner: RunnerProfile;
  runsOpen: boolean;
  onToggleRuns: (open: boolean) => void;
  // 전체 러닝 기록 화면으로 간다
  onOpenRuns?: () => void;
}) {
  const pet =
    runner.pet &&
    CHARACTER_TYPES.includes(runner.pet.character_type) &&
    CHARACTER_STAGE_ORDER.includes(runner.pet.stage)
      ? runner.pet
      : null;
  const totalKm = runner.profile.total_km;
  const next = pet ? getNextStageProgress(pet.stage, totalKm) : null;
  const runs = runner.recent_runs ?? [];
  const runsHidden = runner.runs_hidden === true;
  // 다음 등급까지 가야 하는 전체 거리. "1.6 / 50km"처럼 현재와 목표를 한 줄로 보여 준다
  const goalKm = next ? Number((totalKm + next.remainingKm).toFixed(1)) : null;

  const runsRow = runsHidden ? (
    <View style={styles.runsRow}>
      <View style={styles.runsIcon}>
        <Lock size={18} color={colors.textMuted} />
      </View>
      <AppText variant="caption" color={colors.textMuted}>
        러닝 기록은 비공개예요
      </AppText>
    </View>
  ) : (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="최근 러닝 보기"
      accessibilityState={{ expanded: runsOpen }}
      onPress={() => onToggleRuns(!runsOpen)}
      style={styles.runsRow}
    >
      <View style={styles.runsIcon}>
        <Footprints
          size={18}
          color={runsOpen ? colors.primaryInk : colors.text}
        />
      </View>
      <View style={styles.runsCount}>
        <AppText variant="caption" color={colors.textMuted}>
          완료한 러닝
        </AppText>
        <AppText variant="subheading">{runner.run_count ?? '—'}회</AppText>
      </View>
      <View style={styles.grow} />
      <View style={runsOpen ? undefined : styles.chevronClosed}>
        <ChevronUp size={18} color={colors.textMuted} />
      </View>
    </Pressable>
  );

  // 캐릭터가 없는 러너: 완료한 러닝 줄만 있는 작은 카드
  if (!pet)
    return (
      <Card tone="flat" padded={false} style={styles.plain}>
        {runsRow}
        {runsOpen && !runsHidden && renderBubble()}
      </Card>
    );

  function renderBubble() {
    return (
      <View style={styles.bubble} testID="profile-runs-list">
        {runs.length === 0 ? (
          <AppText variant="caption" color={colors.textMuted}>
            아직 완료한 러닝이 없어요.
          </AppText>
        ) : (
          <ScrollView
            nestedScrollEnabled
            showsVerticalScrollIndicator
            style={styles.bubbleList}
          >
            {runs.map((run, index) => (
              <View
                key={index}
                style={[styles.bubbleRow, index > 0 && styles.bubbleDivider]}
              >
                <AppText variant="label" color={colors.textMuted}>
                  {run.day}
                </AppText>
                <View style={styles.bubbleValues}>
                  <AppText variant="subheading">
                    {run.distance_km.toFixed(2)}km
                  </AppText>
                  <AppText variant="label" color={colors.textMuted}>
                    {formatDuration(run.duration_sec)} ·{' '}
                    {run.avg_pace_sec ? formatPace(run.avg_pace_sec) : '—'}
                  </AppText>
                </View>
              </View>
            ))}
          </ScrollView>
        )}
        {onOpenRuns && runs.length > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="러닝 기록 자세히 보기"
            hitSlop={6}
            onPress={onOpenRuns}
            style={styles.bubbleMore}
          >
            <AppText variant="label" color={colors.primaryInk}>
              자세히 보기
            </AppText>
          </Pressable>
        )}
        <View style={styles.bubbleTail} />
      </View>
    );
  }

  return (
    <Card padded={false} style={styles.card}>
      {/* 말풍선이 떠 있을 때 카드의 다른 곳을 누르면 닫힌다 */}
      {runsOpen && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="러닝 기록 말풍선 닫기"
          onPress={() => onToggleRuns(false)}
          style={[StyleSheet.absoluteFill, styles.dismiss]}
        />
      )}
      {/* 카드는 말풍선 때문에 바깥을 자르지 않으니, 장면의 위쪽 모서리는 여기서 둥글게 자른다 */}
      <View style={styles.scene}>
        <CompanionScene height={SCENE_HEIGHT}>
          <LobbyCharacter
            type={pet.character_type}
            stage={pet.stage}
            size={CHARACTER_SIZE}
            frozen={pet.is_frozen}
            equipped={pet.equipped}
          />
        </CompanionScene>
      </View>
      {/* 홈 화면과 같은 머리글: 왼쪽에 이름, 오른쪽에 레벨 칩 */}
      <View pointerEvents="none" style={styles.header}>
        <View style={styles.headerName}>
          <AppText variant="heading" numberOfLines={1}>
            {pet.pet_name}
          </AppText>
          <AppText variant="label" color={colors.primaryInk}>
            {pet.is_frozen
              ? `${STAGE_LABELS[pet.stage]} · 다음 달리기를 기다려요`
              : STAGE_LABELS[pet.stage]}
          </AppText>
        </View>
        <View style={styles.level}>
          <AppText variant="label" color={colors.primaryInk}>
            LV.{' '}
            {String(CHARACTER_STAGE_ORDER.indexOf(pet.stage) + 1).padStart(
              2,
              '0',
            )}
          </AppText>
        </View>
      </View>
      <View style={styles.footer}>
        <View style={styles.exp}>
          <View style={styles.expHeader}>
            <AppText variant="label" color={colors.textMuted}>
              경험치
            </AppText>
            <AppText variant="label">
              {goalKm === null
                ? `${totalKm.toFixed(1)}km`
                : `${totalKm.toFixed(1)} / ${goalKm}km`}
            </AppText>
          </View>
          <ExpBar
            height={6}
            value={pet.stage === 'egg' ? 0 : next ? next.progress : 1}
          />
          {pet.stage === 'egg' && (
            <AppText variant="label" color={colors.textMuted}>
              첫 달리기를 하면 부화해요
            </AppText>
          )}
          {pet.stage !== 'egg' && !next && (
            <AppText variant="label" color={colors.textMuted}>
              가장 높은 단계예요
            </AppText>
          )}
        </View>
        <View style={styles.stats}>
          {STATS.map(([label, key]) => (
            <View key={key} style={styles.stat}>
              <AppText variant="label" color={colors.textMuted}>
                {label}
              </AppText>
              <AppText variant="heading">{pet[key] ?? 0}</AppText>
              <ProgressBar height={5} value={(pet[key] ?? 0) / STAT_MAX} />
            </View>
          ))}
        </View>
        {runsRow}
      </View>
      {runsOpen && !runsHidden && renderBubble()}
    </Card>
  );
}

const TAIL = 12;
const ROW = 44;
const SIDE = 18;
const styles = StyleSheet.create({
  // 홈의 러닝 메이트 카드와 같은 모서리. 말풍선이 카드 밖으로 나가도 가려지지 않게 zIndex를 둔다
  card: {
    overflow: 'visible',
    borderRadius: radius.xl,
    borderWidth: 0,
    zIndex: 2,
  },
  scene: {
    overflow: 'hidden',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  plain: { zIndex: 2 },
  dismiss: { zIndex: 1 },
  header: {
    position: 'absolute',
    left: SIDE,
    right: SIDE,
    top: 17,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  headerName: { flexShrink: 1 },
  level: {
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  footer: {
    paddingHorizontal: SIDE,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  exp: { gap: 6 },
  expHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  // 스탯 세 개를 같은 폭의 세 칸으로. 글자는 작고 연하게, 숫자는 크고 진하게
  stats: { flexDirection: 'row', gap: spacing.lg },
  stat: { flex: 1, gap: 3 },
  grow: { flex: 1 },
  runsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: ROW,
    paddingTop: spacing.md,
  },
  runsIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  runsCount: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  chevronClosed: { transform: [{ rotate: '180deg' }] },
  // 완료한 러닝 줄 바로 위에 뜨는 말풍선
  bubble: {
    position: 'absolute',
    left: SIDE,
    right: SIDE,
    bottom: spacing.sm + ROW + TAIL + spacing.md,
    zIndex: 2,
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    shadowColor: '#101814',
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  bubbleList: { maxHeight: 140 },
  // 오른쪽 여백은 스크롤바 자리다
  bubbleRow: { paddingVertical: 6, paddingRight: 8, gap: 2 },
  bubbleDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  bubbleValues: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  bubbleMore: { alignSelf: 'flex-end' },
  bubbleTail: {
    position: 'absolute',
    left: 22,
    bottom: -TAIL / 2,
    width: TAIL,
    height: TAIL,
    backgroundColor: colors.surface,
    transform: [{ rotate: '45deg' }],
  },
});
