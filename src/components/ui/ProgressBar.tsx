import React from 'react';
import {StyleSheet, View} from 'react-native';
import {colors, radius} from '../../theme';

type Props = {
  // 0~1
  value: number;
  height?: number;
  color?: string;
  trackColor?: string;
};

export function ProgressBar({value, height = 8, color = colors.primary, trackColor = colors.surfaceMuted}: Props) {
  const ratio = Math.min(1, Math.max(0, value));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{min: 0, max: 100, now: Math.round(ratio * 100)}}
      style={[styles.track, {height, backgroundColor: trackColor}]}>
      {/* 0%여도 시작점이 보이도록 최소 폭을 둔다 */}
      <View style={[styles.fill, {width: `${Math.max(ratio * 100, 2)}%`, backgroundColor: color}]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {borderRadius: radius.pill, overflow: 'hidden'},
  fill: {height: '100%', borderRadius: radius.pill},
});
