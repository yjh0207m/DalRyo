import React from 'react';
import {StyleSheet, View, type ViewProps} from 'react-native';
import {colors, radius, shadow, spacing} from '../../theme';

type Props = ViewProps & {
  // soft: 브랜드 연한 배경 (캐릭터 히어로 등 강조 영역)
  tone?: 'surface' | 'soft' | 'warm' | 'stone';
  padded?: boolean;
};

const TONE_STYLE = {
  surface: {backgroundColor: colors.surface, borderColor: colors.border},
  soft: {backgroundColor: colors.primarySoft, borderColor: colors.primarySoft},
  warm: {backgroundColor: colors.accentSoft, borderColor: colors.accentSoft},
  stone: {backgroundColor: colors.stoneSoft, borderColor: colors.stoneSoft},
} as const;

export function Card({tone = 'surface', padded = true, style, ...rest}: Props) {
  return <View {...rest} style={[styles.base, TONE_STYLE[tone], tone === 'surface' && shadow.card, padded && styles.padded, style]} />;
}

const styles = StyleSheet.create({
  base: {borderRadius: radius.lg, borderWidth: 1},
  padded: {padding: spacing.xl},
});
