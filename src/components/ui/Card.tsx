import React from 'react';
import { View, type ViewProps } from 'react-native';
import { colors, radius, spacing, themedStyles } from '../../theme';

type Tone = 'surface' | 'soft' | 'warm' | 'stone' | 'flat';

type Props = ViewProps & {
  // soft: 브랜드 연한 배경 (캐릭터 히어로 등 강조 영역)
  tone?: Tone;
  padded?: boolean;
};

export function Card({
  tone = 'surface',
  padded = true,
  style,
  ...rest
}: Props) {
  return (
    <View
      {...rest}
      style={[styles.base, styles[tone], padded && styles.padded, style]}
    />
  );
}

// 톤별 색도 테마를 따라가도록 스타일 안에 둔다
const styles = themedStyles(() => ({
  base: { borderRadius: radius.md },
  padded: { padding: spacing.xl },
  flat: { backgroundColor: 'transparent', borderRadius: 0 },
  surface: { backgroundColor: colors.surface, borderColor: colors.border },
  soft: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primarySoft,
  },
  warm: { backgroundColor: colors.accentSoft, borderColor: colors.accentSoft },
  stone: { backgroundColor: colors.stoneSoft, borderColor: colors.stoneSoft },
}));
