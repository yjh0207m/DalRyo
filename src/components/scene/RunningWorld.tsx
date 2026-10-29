import React, {useEffect, useRef} from 'react';
import {Animated, Easing, StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle} from 'react-native';
import Svg, {Circle, Ellipse, G, Path} from 'react-native-svg';
import {colors} from '../../theme';

// 달리기 화면의 "횡스크롤 월드". 구름·먼 언덕·가까운 땅이 서로 다른 속도로 흘러(패럴랙스)
// 캐릭터가 실제로 앞으로 달려 나가는 것처럼 보이게 한다. 속도는 실제 달리기 속도(km/h)를 따른다.

type Props = {
  speedKmh: number;
  height: number;
  // 땅 윗면이 높이의 어디쯤인지(위에서부터 비율). 캐릭터 발 위치
  groundTop?: number;
  // 구름 띠가 높이의 어디쯤인지(위에서부터 비율). 위쪽에 UI가 겹치는 화면은 내린다
  cloudsTop?: number;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

// 10km/h일 때 가까운 땅이 초당 약 320px 흐른다
const GROUND_PX_PER_MS_PER_KMH = 0.032;
const HILL_FACTOR = 0.35;
const CLOUD_FACTOR = 0.08;
// 멈춰 있어도 구름은 아주 천천히 흐른다
const CLOUD_IDLE_PX_PER_MS = 0.006;

export function RunningWorld({speedKmh, height, groundTop = 0.6, cloudsTop = 0.06, children, style}: Props) {
  const {width} = useWindowDimensions();
  const groundY = height * groundTop;

  // 속도가 조금씩 바뀔 때마다 애니메이션을 다시 시작하지 않도록 1km/h 단위로 끊는다
  const bucket = Math.max(0, Math.round(speedKmh));

  const clouds = useScroll(width, CLOUD_IDLE_PX_PER_MS + (bucket * GROUND_PX_PER_MS_PER_KMH) * CLOUD_FACTOR);
  const hills = useScroll(width, bucket * GROUND_PX_PER_MS_PER_KMH * HILL_FACTOR);
  const ground = useScroll(width, bucket * GROUND_PX_PER_MS_PER_KMH);

  return (
    <View style={[{height}, styles.wrap, style]}>
      <Animated.View style={[styles.strip, {width: width * 2, top: height * cloudsTop, transform: [{translateX: clouds}]}]}>
        {[0, 1].map(tile => (
          <CloudTile key={tile} width={width} />
        ))}
      </Animated.View>

      <Animated.View style={[styles.strip, {width: width * 2, top: groundY - height * 0.24, height: height * 0.3, transform: [{translateX: hills}]}]}>
        {[0, 1].map(tile => (
          <Svg key={tile} width={width + 1} height="100%" viewBox="0 0 400 100" preserveAspectRatio="none" style={styles.tileOverlap}>
            {/* 양 끝 높이가 같아야 타일을 이어 붙였을 때 이음새가 안 보인다 */}
            <Path d="M0 60 C60 20 120 22 180 48 S300 30 400 60 L400 100 L0 100 Z" fill={colors.grassBack} />
          </Svg>
        ))}
      </Animated.View>

      <Animated.View style={[styles.strip, styles.groundStrip, {width: width * 2, top: groundY, transform: [{translateX: ground}]}]}>
        {[0, 1].map(tile => (
          <GroundTile key={tile} width={width} />
        ))}
      </Animated.View>

      {children && <View style={[styles.actor, {top: groundY}]}>{children}</View>}
    </View>
  );
}

// 0 → -width 로 계속 흐르는 값. 속도가 바뀌면 현재 위치에서 이어서 새 속도로 흐른다
function useScroll(width: number, pxPerMs: number) {
  const value = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;

    if (pxPerMs <= 0) {
      value.stopAnimation();
      return undefined;
    }

    const run = (from: number) => {
      if (cancelled) return;
      value.setValue(from);
      Animated.timing(value, {
        toValue: -width,
        duration: (width + from) / pxPerMs,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(({finished}) => {
        if (finished) run(0);
      });
    };

    value.stopAnimation(current => run(current <= -width ? 0 : current));

    return () => {
      cancelled = true;
      value.stopAnimation();
    };
  }, [value, width, pxPerMs]);

  return value;
}

function CloudTile({width}: {width: number}) {
  return (
    <Svg width={width} height={90} viewBox="0 0 400 90">
      <G fill={colors.cloud} opacity={0.9}>
        <Cloud x={60} y={30} scale={1} />
        <Cloud x={250} y={55} scale={0.7} />
        <Cloud x={340} y={18} scale={0.55} />
      </G>
    </Svg>
  );
}

function Cloud({x, y, scale}: {x: number; y: number; scale: number}) {
  return (
    <G transform={`translate(${x} ${y}) scale(${scale})`}>
      <Ellipse cx={0} cy={8} rx={34} ry={12} />
      <Circle cx={-12} cy={0} r={14} />
      <Circle cx={10} cy={-4} r={18} />
    </G>
  );
}

// 가까운 땅: 평평한 풀밭 + 풀 포기·꽃·작은 돌. 모양이 찌그러지지 않도록 고정 크기 요소를 비율 위치에 둔다
const TUFTS = [0.06, 0.24, 0.47, 0.63, 0.86];
const FLOWERS: Array<[number, number]> = [
  [0.14, 0.35],
  [0.38, 0.6],
  [0.55, 0.28],
  [0.78, 0.52],
  [0.93, 0.3],
];

function GroundTile({width}: {width: number}) {
  return (
    <View style={[styles.groundTile, styles.tileOverlap, {width: width + 1}]}>
      <View style={styles.groundEdge} />
      {TUFTS.map(x => (
        <Svg key={`t${x}`} width={18} height={14} viewBox="0 0 18 14" style={[styles.deco, styles.tuft, {left: x * width}]}>
          <Path d="M0 14 q3 -11 5 0 q3 -14 5 0 q3 -10 5 0 Z" fill={colors.grassShade} />
        </Svg>
      ))}
      {FLOWERS.map(([x, y]) => (
        <Svg key={`f${x}`} width={10} height={10} viewBox="-5 -5 10 10" style={[styles.deco, {left: x * width, top: `${y * 100}%`}]}>
          <Circle r={4.5} fill={colors.flower} />
          <Circle r={1.9} fill={colors.flowerCenter} />
        </Svg>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {overflow: 'hidden', width: '100%'},
  strip: {position: 'absolute', left: 0, flexDirection: 'row'},
  groundTile: {height: '100%', backgroundColor: colors.grassFront},
  groundEdge: {height: 10, backgroundColor: colors.grassShade, opacity: 0.35},
  deco: {position: 'absolute'},
  tuft: {top: -10},
  groundStrip: {bottom: 0},
  // 타일 폭이 소수점이면 이음새에 1px 틈이 보여 1px씩 겹친다
  tileOverlap: {marginRight: -1},
  actor: {position: 'absolute', left: 0, right: 0, alignItems: 'center'},
});
