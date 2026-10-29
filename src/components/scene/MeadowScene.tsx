import React from 'react';
import {StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native';
import Svg, {Circle, G, Path} from 'react-native-svg';
import {colors} from '../../theme';

// 앱 공용 "초원" 장면. 홈·달리기·완료 화면이 같은 들판 위에서 이어지도록 한다.
// 캐릭터(children)는 앞 언덕 능선 위에 서도록 배치된다.

type Props = {
  height?: number;
  // 앞 언덕 능선이 장면 높이의 어디쯤인지(아래에서부터 비율). 캐릭터 발 위치가 된다
  groundRatio?: number;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

const VIEW_W = 400;
const VIEW_H = 140;

const FLOWERS: Array<[number, number, number]> = [
  [34, 104, 3.2],
  [96, 122, 2.6],
  [148, 98, 2.4],
  [262, 118, 3],
  [318, 96, 2.6],
  [372, 112, 3.2],
];

const TUFTS = [18, 70, 132, 236, 290, 352];

export function MeadowScene({height = 150, groundRatio = 0.5, children, style}: Props) {
  return (
    <View style={[styles.wrap, {height}, style]}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
        <Path d="M0 46 C70 22 150 30 214 44 S338 30 400 22 L400 140 L0 140 Z" fill={colors.grassBack} />
        <Path d="M0 78 C66 58 146 60 208 70 S330 68 400 56 L400 140 L0 140 Z" fill={colors.grassFront} />
        <Path d="M0 118 C120 104 262 114 400 100 L400 140 L0 140 Z" fill={colors.grassShade} opacity={0.35} />
      </Svg>
      {/* 언덕은 화면 비율에 맞춰 늘어나지만, 꽃·풀 포기는 늘어나면 찌그러지므로 위치만 비율로 잡고 모양은 고정 크기로 그린다 */}
      {TUFTS.map(x => (
        <Svg
          key={`tuft-${x}`}
          width={14}
          height={12}
          viewBox="0 0 14 12"
          style={[styles.deco, {left: `${(x / VIEW_W) * 100}%`, top: `${((groundY(x) - 6) / VIEW_H) * 100}%`}]}>
          <Path d="M0 12 q2 -9 4 0 q2 -12 4 0 q2 -8 4 0 Z" fill={colors.grassShade} />
        </Svg>
      ))}
      {FLOWERS.map(([x, y, r]) => (
        <Svg
          key={`flower-${x}-${y}`}
          width={r * 3}
          height={r * 3}
          viewBox="-1.5 -1.5 3 3"
          style={[styles.deco, {left: `${(x / VIEW_W) * 100}%`, top: `${(y / VIEW_H) * 100}%`, marginLeft: -r * 1.5, marginTop: -r * 1.5}]}>
          <G>
            <Circle cx={0} cy={0} r={1} fill={colors.flower} />
            <Circle cx={0} cy={0} r={0.42} fill={colors.flowerCenter} />
          </G>
        </Svg>
      ))}
      {children && <View style={[styles.stage, {bottom: height * groundRatio}]}>{children}</View>}
    </View>
  );
}

// 앞 언덕 능선의 대략적인 y (풀 포기를 능선에 붙이기 위함)
function groundY(x: number) {
  const t = x / VIEW_W;
  return 78 - 20 * Math.sin(t * Math.PI * 0.9) + (t > 0.5 ? -4 : 0);
}

const styles = StyleSheet.create({
  wrap: {width: '100%', overflow: 'visible'},
  stage: {position: 'absolute', left: 0, right: 0, alignItems: 'center'},
  deco: {position: 'absolute'},
});
