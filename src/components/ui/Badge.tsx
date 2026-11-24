import React from 'react';
import {StyleSheet, View} from 'react-native';
import {colors, radius} from '../../theme';
import {AppText} from './AppText';

// onSoft: 연한 초록 배경(히어로 카드 등) 위에 올릴 때
type Tone = 'brand' | 'onSoft' | 'warm' | 'neutral' | 'stone';

// 테마가 바뀌어도 따라가도록 그릴 때마다 지금 색을 읽는다
function toneColors(tone: Tone): {bg: string; fg: string} {
  switch (tone) {
    case 'onSoft':
      return {bg: colors.surface, fg: colors.primaryInk};
    case 'warm':
      return {bg: colors.accentSoft, fg: colors.accentInk};
    case 'neutral':
      return {bg: colors.surfaceMuted, fg: colors.textMuted};
    case 'stone':
      return {bg: colors.stoneSoft, fg: colors.textMuted};
    default:
      return {bg: colors.primarySoft, fg: colors.primaryInk};
  }
}

export function Badge({label, tone = 'brand'}: {label: string; tone?: Tone}) {
  const {bg, fg} = toneColors(tone);
  return (
    <View style={[styles.base, {backgroundColor: bg}]}>
      <AppText variant="label" color={fg}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill},
});
