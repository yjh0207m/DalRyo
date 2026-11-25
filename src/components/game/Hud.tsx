import React from 'react';
import {View} from 'react-native';
import { Flame } from 'lucide-react-native';
import { colors, radius, spacing, themedStyles } from '../../theme';
import { AppText } from '../ui';

// 게임식 상태 표시(HUD) 조각들: 두꺼운 경험치 바, 연속 기록 칩

// 두꺼운 게임식 바. 위쪽에 밝은 줄을 넣어 입체감을 준다
export function ExpBar({
  value,
  height = 14,
  trackColor,
}: {
  value: number;
  height?: number;
  // 바탕이 회색 띠일 때처럼 기본 바탕색과 겹치면 다른 색을 준다
  trackColor?: string;
}) {
  const ratio = Math.min(1, Math.max(0, value));
  return (
    <View
      style={[
        styles.expTrack,
        { height, borderRadius: height / 2 },
        trackColor ? { backgroundColor: trackColor } : null,
      ]}
    >
      <View
        style={[
          styles.expFill,
          { width: `${ratio * 100}%`, borderRadius: height / 2 },
        ]}
      >
        <View
          style={[
            styles.expShine,
            { height: height * 0.3, borderRadius: height },
          ]}
        />
      </View>
    </View>
  );
}

export function StreakChip({ days }: { days: number }) {
  const active = days > 0;
  return (
    <View style={[styles.chip, active ? styles.chipActive : styles.chipIdle]}>
      <Flame
        color={active ? colors.accent : colors.textSubtle}
        fill={active ? colors.accent : 'transparent'}
        size={16}
      />
      <AppText
        variant="label"
        color={active ? colors.accentInk : colors.textMuted}
      >
        {active ? `${days}일 연속` : '연속 기록 없음'}
      </AppText>
    </View>
  );
}

const styles = themedStyles(() => ({
  expTrack: {
    backgroundColor: colors.progressTrack,
    overflow: 'hidden',
    borderWidth: 0,
    borderColor: colors.border,
  },
  expFill: {
    height: '100%',
    backgroundColor: colors.primary,
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  expShine: { backgroundColor: 'transparent' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  chipActive: { backgroundColor: colors.accentSoft },
  chipIdle: { backgroundColor: colors.surface },
}));
