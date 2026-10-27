import React from 'react';
import {StyleSheet, View} from 'react-native';
import {colors, radius} from '../../theme';
import {AppText} from './AppText';

// onSoft: 연한 초록 배경(히어로 카드 등) 위에 올릴 때
type Tone = 'brand' | 'onSoft' | 'warm' | 'neutral' | 'stone';

const TONES: Record<Tone, {bg: string; fg: string}> = {
  brand: {bg: colors.primarySoft, fg: colors.primaryInk},
  onSoft: {bg: colors.surface, fg: colors.primaryInk},
  warm: {bg: colors.accentSoft, fg: colors.accentInk},
  neutral: {bg: colors.surfaceMuted, fg: colors.textMuted},
  stone: {bg: colors.stoneSoft, fg: colors.textMuted},
};

export function Badge({label, tone = 'brand'}: {label: string; tone?: Tone}) {
  return (
    <View style={[styles.base, {backgroundColor: TONES[tone].bg}]}>
      <AppText variant="label" color={TONES[tone].fg}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill},
});
