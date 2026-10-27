import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Flame} from 'lucide-react-native';
import {colors, fonts, radius, spacing} from '../../theme';
import {AppText} from '../ui';

// 게임식 상태 표시(HUD) 조각들: 레벨 배지, 두꺼운 경험치 바, 연속 기록 칩

export function LevelBadge({level, size = 48}: {level: number; size?: number}) {
  return (
    <View style={[styles.badgeRing, {width: size, height: size, borderRadius: size / 2}]}>
      <View style={[styles.badge, {width: size - 8, height: size - 8, borderRadius: (size - 8) / 2}]}>
        <AppText style={[styles.badgeLabel, {fontSize: size * 0.18}]} color={colors.goldInk}>
          Lv
        </AppText>
        <AppText style={[styles.badgeNumber, {fontSize: size * 0.38, lineHeight: size * 0.42}]} color={colors.goldInk}>
          {level}
        </AppText>
      </View>
    </View>
  );
}

// 두꺼운 게임식 바. 위쪽에 밝은 줄을 넣어 입체감을 준다
export function ExpBar({value, height = 14}: {value: number; height?: number}) {
  const ratio = Math.min(1, Math.max(0, value));
  return (
    <View style={[styles.expTrack, {height, borderRadius: height / 2}]}>
      <View style={[styles.expFill, {width: `${Math.max(ratio * 100, 6)}%`, borderRadius: height / 2}]}>
        <View style={[styles.expShine, {height: height * 0.3, borderRadius: height}]} />
      </View>
    </View>
  );
}

export function StreakChip({days}: {days: number}) {
  const active = days > 0;
  return (
    <View style={[styles.chip, active ? styles.chipActive : styles.chipIdle]}>
      <Flame color={active ? colors.accent : colors.textSubtle} fill={active ? colors.accent : 'transparent'} size={16} />
      <AppText variant="label" color={active ? colors.accentInk : colors.textMuted}>
        {active ? `${days}일 연속` : '연속 기록 없음'}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badgeRing: {backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.gold},
  badge: {backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center'},
  badgeLabel: {fontFamily: fonts.bold, lineHeight: 12, marginBottom: -2},
  badgeNumber: {fontFamily: fonts.extrabold},
  expTrack: {backgroundColor: colors.surfaceMuted, overflow: 'hidden', borderWidth: 1, borderColor: colors.border},
  expFill: {height: '100%', backgroundColor: colors.primary, paddingHorizontal: 4, paddingTop: 2},
  expShine: {backgroundColor: 'rgba(255,255,255,0.45)'},
  chip: {flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill},
  chipActive: {backgroundColor: colors.accentSoft},
  chipIdle: {backgroundColor: colors.surface},
});
