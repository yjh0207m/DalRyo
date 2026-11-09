import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { colors, radius, spacing } from '../../theme';

type Props = ViewProps & {
  // soft: 브랜드 연한 배경 (캐릭터 히어로 등 강조 영역)
  tone?: 'surface' | 'soft' | 'warm' | 'stone' | 'flat';
  padded?: boolean;
};

const TONE_STYLE = {
  flat: { backgroundColor: 'transparent', borderRadius: 0 },
  surface: { backgroundColor: colors.surface, borderColor: colors.border },
  soft: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primarySoft,
  },
  warm: { backgroundColor: colors.accentSoft, borderColor: colors.accentSoft },
  stone: { backgroundColor: colors.stoneSoft, borderColor: colors.stoneSoft },
} as const;

export function Card({
  tone = 'surface',
  padded = true,
  style,
  ...rest
}: Props) {
  return (
    <View
      {...rest}
      style={[styles.base, TONE_STYLE[tone], padded && styles.padded, style]}
    />
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.md },
  padded: { padding: spacing.xl },
});
