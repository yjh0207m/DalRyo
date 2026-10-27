import React, {useEffect, useMemo, useRef} from 'react';
import {Animated, Easing, StyleSheet, View} from 'react-native';
import {colors} from '../../theme';

// 위에서 흩날리며 떨어지는 색종이. 한 번만 뿌리고 사라진다 (부화·성장·해동처럼 큰 순간에만 쓴다)

const PALETTE = [colors.primary, colors.gold, colors.heart, '#7CC8F2', '#FFFFFF'];
const COUNT = 26;

type Piece = {x: number; drift: number; delay: number; spin: number; color: string; wide: boolean; fall: number};

export function Confetti({width, height, durationMs = 1900}: {width: number; height: number; durationMs?: number}) {
  const progress = useRef(new Animated.Value(0)).current;
  // 매 렌더마다 모양이 바뀌지 않도록 한 번만 뽑는다
  const pieces = useMemo<Piece[]>(
    () =>
      Array.from({length: COUNT}, (_, i) => ({
        x: Math.random() * width,
        drift: (Math.random() - 0.5) * 80,
        delay: Math.random() * 0.25,
        spin: (Math.random() < 0.5 ? -1 : 1) * (240 + Math.random() * 360),
        color: PALETTE[i % PALETTE.length],
        wide: i % 3 === 0,
        fall: height * (0.75 + Math.random() * 0.35),
      })),
    [width, height],
  );

  useEffect(() => {
    Animated.timing(progress, {toValue: 1, duration: durationMs, easing: Easing.out(Easing.quad), useNativeDriver: true}).start();
  }, [progress, durationMs]);

  return (
    <View pointerEvents="none" style={[styles.layer, {width, height}]}>
      {pieces.map((piece, index) => {
        const local = progress.interpolate({inputRange: [0, piece.delay, 1], outputRange: [0, 0, 1], extrapolate: 'clamp'});
        return (
          <Animated.View
            key={index}
            style={[
              styles.piece,
              piece.wide ? styles.wide : styles.tall,
              {
                left: piece.x,
                backgroundColor: piece.color,
                opacity: local.interpolate({inputRange: [0, 0.05, 0.8, 1], outputRange: [0, 1, 1, 0]}),
                transform: [
                  {translateY: local.interpolate({inputRange: [0, 1], outputRange: [-20, piece.fall]})},
                  {translateX: local.interpolate({inputRange: [0, 1], outputRange: [0, piece.drift]})},
                  {rotate: local.interpolate({inputRange: [0, 1], outputRange: ['0deg', `${piece.spin}deg`]})},
                ],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {position: 'absolute', top: 0, left: 0, overflow: 'hidden'},
  piece: {position: 'absolute', top: 0, borderRadius: 2},
  wide: {width: 12, height: 7},
  tall: {width: 7, height: 12},
});
