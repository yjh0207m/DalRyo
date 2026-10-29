import React from 'react';
import {StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native';
import Svg, {Circle, Ellipse, G, Path} from 'react-native-svg';
import {colors, radius, shadow, spacing} from '../../theme';
import {AppText} from '../ui';

// 홈 화면의 "풀밭 섬". 캐릭터(children)가 섬 윗면에 서고, 옆에 말풍선을 띄운다.

type Props = {
  width?: number;
  // 캐릭터 박스 크기 (발이 섬 윗면에 닿도록 위치를 맞추는 데 쓴다)
  characterSize: number;
  speech?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

const ISLAND_H = 70;

export function IslandScene({width = 300, characterSize, speech, children, style}: Props) {
  return (
    <View style={[{width, height: characterSize * 0.83 + ISLAND_H * 0.5}, styles.wrap, style]}>
      <Svg width={width} height={ISLAND_H} viewBox="0 0 300 70" style={styles.island}>
        {/* 바닥 그림자 → 옆면 → 윗면 순서로 쌓아 두께감을 준다 */}
        <Ellipse cx={150} cy={58} rx={128} ry={10} fill="rgba(16,60,50,0.10)" />
        <Path d="M22 30 C22 50 70 60 150 60 C230 60 278 50 278 30 Z" fill={colors.grassShade} />
        <Ellipse cx={150} cy={30} rx={128} ry={24} fill={colors.grassFront} />
        <Ellipse cx={150} cy={26} rx={110} ry={16} fill={colors.grassBack} opacity={0.55} />
        <G fill={colors.grassShade}>
          <Path d="M48 34 q2 -8 4 0 q2 -10 4 0 q2 -7 4 0 Z" />
          <Path d="M236 36 q2 -8 4 0 q2 -10 4 0 q2 -7 4 0 Z" />
          <Path d="M196 20 q2 -6 3 0 q2 -8 3 0 Z" />
        </G>
        {[
          [72, 38, 3.2],
          [222, 24, 2.8],
          [254, 34, 2.4],
          [96, 22, 2.2],
        ].map(([x, y, r]) => (
          <G key={`${x}-${y}`}>
            <Circle cx={x} cy={y} r={r} fill={colors.flower} />
            <Circle cx={x} cy={y} r={r * 0.42} fill={colors.flowerCenter} />
          </G>
        ))}
      </Svg>
      <View style={[styles.character, {bottom: ISLAND_H * 0.5 - characterSize * 0.17}]}>{children}</View>
      {speech && (
        <View style={[styles.bubble, {left: width / 2 + characterSize * 0.22, bottom: characterSize * 0.62}]}>
          <AppText variant="caption" color={colors.text}>
            {speech}
          </AppText>
          <View style={styles.tail} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {alignSelf: 'center'},
  island: {position: 'absolute', left: 0, bottom: 0},
  character: {position: 'absolute', left: 0, right: 0, alignItems: 'center'},
  bubble: {
    position: 'absolute',
    maxWidth: 150,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  tail: {
    position: 'absolute',
    left: 12,
    bottom: -6,
    width: 12,
    height: 12,
    backgroundColor: colors.surface,
    transform: [{rotate: '45deg'}],
  },
});
