import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient,
  Path,
  Stop,
} from 'react-native-svg';
import { colors } from '../../theme';

// Scenery follows the card's width, so a compact character can stay in focus.
export function CompanionScene({
  children,
  height = 242,
}: {
  children: React.ReactNode;
  height?: number;
}) {
  return (
    <View style={[styles.scene, { height }]}>
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 360 242"
        preserveAspectRatio="xMidYMid slice"
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <Defs>
          <LinearGradient id="scene-sky" x1="0" y1="0" x2="0.3" y2="1">
            <Stop offset="0" stopColor={colors.background} />
            <Stop offset="1" stopColor={colors.sceneSky} />
          </LinearGradient>
        </Defs>
        <Path d="M0 0H360V242H0Z" fill="url(#scene-sky)" />
        <Circle cx="267" cy="66" r="42" fill={colors.flowerCenter} opacity="0.63" />
        <Path d="M-20 163 Q75 127 165 155 T390 153 V242 H-20Z" fill={colors.grassBack} />
        <Path
          d="M-20 190 Q120 152 258 181 T390 179 V242 H-20Z"
          fill={colors.grassFront}
        />
        <Ellipse cx="180" cy="228" rx="161" ry="43" fill={colors.track} />
        <Ellipse
          cx="180"
          cy="228"
          rx="141"
          ry="32"
          fill="none"
          stroke={colors.trackLine}
          strokeWidth="1.3"
        />
        <Ellipse
          cx="180"
          cy="228"
          rx="119"
          ry="21"
          fill="none"
          stroke={colors.trackLine}
          strokeWidth="1.2"
          strokeDasharray="5 7"
        />
        <Path
          d="M39 195V166M39 166L58 172L39 178"
          fill={colors.primary}
          stroke={colors.primary}
          strokeWidth="1.3"
        />
        <Path
          d="M310 167V145M310 145L324 150L310 155"
          fill={colors.grassShade}
          stroke={colors.grassShade}
          strokeWidth="1.3"
        />
        <Path
          d="M20 115H74M30 122H60M292 119H329"
          stroke="#FFFFFF"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.65"
        />
      </Svg>
      <View style={styles.actor}>{children}</View>
    </View>
  );
}
const styles = StyleSheet.create({
  scene: { overflow: 'hidden', backgroundColor: colors.sceneSky },
  actor: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 6,
    alignItems: 'center',
  },
});
