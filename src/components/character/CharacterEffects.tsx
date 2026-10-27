import React, {useEffect, useRef} from 'react';
import {Animated, Easing, StyleSheet, View} from 'react-native';
import Svg, {Ellipse, Path} from 'react-native-svg';
import type {CharacterMotion} from '../../types/character.types';

// 캐릭터 몸은 거의 움직이지 않으므로, 달리는 느낌은 주변 효과로 낸다.
//   달리기·질주: 머리 뒤로 땀방울이 튄다 (질주일수록 자주)
//   질주: 몸 뒤로 속도선이 흐른다
// 모두 캐릭터 뒤에 그리고, 바라보는 방향의 반대쪽(뒤)으로 날아간다.

type Props = {
  motion: CharacterMotion;
  size: number;
  facing: 'left' | 'right';
};

const SWEAT_INTERVAL: Partial<Record<CharacterMotion, number>> = {run: 1500, sprint: 850};

export function CharacterEffects({motion, size, facing}: Props) {
  const behind = facing === 'right' ? -1 : 1;
  const sweatEvery = SWEAT_INTERVAL[motion];
  return (
    <View pointerEvents="none" style={[styles.layer, {width: size, height: size}]}>
      {motion === 'sprint' && <SpeedLines size={size} behind={behind} />}
      {sweatEvery && <Sweat size={size} behind={behind} everyMs={sweatEvery} />}
    </View>
  );
}

function Sweat({size, behind, everyMs}: {size: number; behind: number; everyMs: number}) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, {toValue: 1, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true}),
        Animated.timing(value, {toValue: 0, duration: 0, useNativeDriver: true}),
        Animated.delay(Math.max(0, everyMs - 700)),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [value, everyMs]);

  const drop = size * 0.07;
  return (
    <Animated.View
      style={[
        styles.layer,
        {
          width: drop,
          height: drop * 1.4,
          // 머리 뒤쪽 위에서 시작
          left: size * (0.5 + behind * 0.05) - drop / 2,
          top: size * 0.24,
          opacity: value.interpolate({inputRange: [0, 0.1, 0.7, 1], outputRange: [0, 1, 1, 0]}),
          transform: [
            {translateX: value.interpolate({inputRange: [0, 1], outputRange: [0, behind * size * 0.14]})},
            // 살짝 떠올랐다가 떨어지는 포물선
            {translateY: value.interpolate({inputRange: [0, 0.35, 1], outputRange: [0, -size * 0.04, size * 0.1]})},
            {rotate: `${behind * -25}deg`},
          ],
        },
      ]}
    >
      <Svg width={drop} height={drop * 1.4} viewBox="0 0 10 14">
        <Path d="M5 0 C5 0 10 6.5 10 9 a5 5 0 0 1 -10 0 C0 6.5 5 0 5 0Z" fill="#9AD8F8" stroke="#5DB6E6" strokeWidth={0.9} />
        <Ellipse cx={3.6} cy={9} rx={1.2} ry={1.8} fill="#FFFFFF" opacity={0.85} />
      </Svg>
    </Animated.View>
  );
}

const LINE_ROWS = [0.48, 0.58, 0.68];

function SpeedLines({size, behind}: {size: number; behind: number}) {
  const values = useRef(LINE_ROWS.map(() => new Animated.Value(0))).current;
  useEffect(() => {
    const loops = values.map((value, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 120),
          Animated.timing(value, {toValue: 1, duration: 380, easing: Easing.out(Easing.quad), useNativeDriver: true}),
          Animated.timing(value, {toValue: 0, duration: 0, useNativeDriver: true}),
          Animated.delay((LINE_ROWS.length - 1 - index) * 120),
        ]),
      ),
    );
    loops.forEach(loop => loop.start());
    return () => loops.forEach(loop => loop.stop());
  }, [values]);

  const width = size * 0.16;
  return (
    <>
      {values.map((value, index) => (
        <Animated.View
          key={index}
          style={[
            styles.line,
            {
              width: width * (index === 1 ? 1.3 : 1),
              height: Math.max(3, size * 0.016),
              borderRadius: size,
              left: size * (0.5 + behind * 0.3) - width / 2,
              top: size * LINE_ROWS[index],
              opacity: value.interpolate({inputRange: [0, 0.2, 1], outputRange: [0, 0.9, 0]}),
              transform: [{translateX: value.interpolate({inputRange: [0, 1], outputRange: [0, behind * size * 0.22]})}],
            },
          ]}
        />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  layer: {position: 'absolute', top: 0, left: 0},
  line: {position: 'absolute', backgroundColor: '#FFFFFF'},
});
