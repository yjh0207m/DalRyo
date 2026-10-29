import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radius } from '../../theme';

type Props = {
  // 0~1
  value: number;
  height?: number;
  color?: string;
  trackColor?: string;
};

export function ProgressBar({
  value,
  height = 8,
  color = colors.primary,
  trackColor = colors.surfaceMuted,
}: Props) {
  const ratio = Math.min(1, Math.max(0, value));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(ratio * 100) }}
      style={[styles.track, { height, backgroundColor: trackColor }]}
    >
      {/* Show the actual value, including a truly empty zero state. */}
      <View
        style={[
          styles.fill,
          { width: `${ratio * 100}%`, backgroundColor: color },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
});
