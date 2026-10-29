import React, {useEffect, useRef} from 'react';
import {Animated, Easing, StyleSheet, View} from 'react-native';
import Svg, {Path} from 'react-native-svg';
import {colors} from '../../theme';

// 순간 연출용 작은 효과들. 모두 한 번 재생되고 끝난다.

// 가운데에서 사방으로 퍼지는 반짝임 (일반 완주)
export function SparkleBurst({size, color = colors.gold, count = 8}: {size: number; color?: string; count?: number}) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progress, {toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true}).start();
  }, [progress]);

  const star = size * 0.09;
  return (
    <View pointerEvents="none" style={[styles.layer, {width: size, height: size}]}>
      {Array.from({length: count}, (_, i) => {
        const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
        const reach = size * (i % 2 === 0 ? 0.48 : 0.36);
        return (
          <Animated.View
            key={i}
            style={[
              styles.layer,
              {
                left: size / 2 - star / 2,
                top: size / 2 - star / 2,
                opacity: progress.interpolate({inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 1, 1, 0]}),
                transform: [
                  {translateX: progress.interpolate({inputRange: [0, 1], outputRange: [0, Math.cos(angle) * reach]})},
                  {translateY: progress.interpolate({inputRange: [0, 1], outputRange: [0, Math.sin(angle) * reach]})},
                  {scale: progress.interpolate({inputRange: [0, 0.3, 1], outputRange: [0.2, 1.1, 0.6]})},
                ],
              },
            ]}
          >
            <Star size={star} color={color} />
          </Animated.View>
        );
      })}
    </View>
  );
}

// 돌이 깨질 때 튀는 회색 조각 (해동)
export function ShardBurst({size}: {size: number}) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progress, {toValue: 1, duration: 800, easing: Easing.out(Easing.quad), useNativeDriver: true}).start();
  }, [progress]);

  const shard = size * 0.06;
  return (
    <View pointerEvents="none" style={[styles.layer, {width: size, height: size}]}>
      {Array.from({length: 12}, (_, i) => {
        const angle = (i / 12) * Math.PI * 2 + 0.3;
        const reach = size * (0.32 + (i % 3) * 0.08);
        return (
          <Animated.View
            key={i}
            style={[
              styles.layer,
              styles.shard,
              {
                width: shard * (i % 2 ? 1 : 1.4),
                height: shard,
                left: size / 2 - shard / 2,
                top: size * 0.55 - shard / 2,
                opacity: progress.interpolate({inputRange: [0, 0.7, 1], outputRange: [1, 1, 0]}),
                transform: [
                  {translateX: progress.interpolate({inputRange: [0, 1], outputRange: [0, Math.cos(angle) * reach]})},
                  // 튀어 올랐다가 중력으로 떨어진다
                  {translateY: progress.interpolate({inputRange: [0, 0.5, 1], outputRange: [0, Math.sin(angle) * reach - size * 0.1, Math.sin(angle) * reach + size * 0.12]})},
                  {rotate: progress.interpolate({inputRange: [0, 1], outputRange: ['0deg', `${(i % 2 ? 1 : -1) * 220}deg`]})},
                ],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

// 캐릭터 뒤에서 천천히 도는 빛줄기 (부화·성장)
export function SunRays({size}: {size: number}) {
  const spin = useRef(new Animated.Value(0)).current;
  const appear = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(appear, {toValue: 1, duration: 500, easing: Easing.out(Easing.quad), useNativeDriver: true}).start();
    const loop = Animated.loop(Animated.timing(spin, {toValue: 1, duration: 14000, easing: Easing.linear, useNativeDriver: true}));
    loop.start();
    return () => loop.stop();
  }, [spin, appear]);

  const r = size / 2;
  const rays = 12;
  const path = Array.from({length: rays}, (_, i) => {
    const a = (i / rays) * Math.PI * 2;
    const b = a + Math.PI / rays;
    return `M${r} ${r} L${r + Math.cos(a) * r} ${r + Math.sin(a) * r} L${r + Math.cos(b) * r} ${r + Math.sin(b) * r} Z`;
  }).join(' ');

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.layer,
        {
          width: size,
          height: size,
          opacity: appear.interpolate({inputRange: [0, 1], outputRange: [0, 0.55]}),
          transform: [{scale: appear.interpolate({inputRange: [0, 1], outputRange: [0.6, 1]})}, {rotate: spin.interpolate({inputRange: [0, 1], outputRange: ['0deg', '360deg']})}],
        },
      ]}
    >
      <Svg width={size} height={size}>
        <Path d={path} fill="#FFF6C9" />
      </Svg>
    </Animated.View>
  );
}

// 한순간 하얗게 번쩍 (변신 순간을 가린다)
export function Flash({size}: {size: number}) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progress, {toValue: 1, duration: 650, easing: Easing.out(Easing.quad), useNativeDriver: true}).start();
  }, [progress]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.layer,
        styles.flash,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          opacity: progress.interpolate({inputRange: [0, 0.12, 1], outputRange: [0, 1, 0]}),
          transform: [{scale: progress.interpolate({inputRange: [0, 1], outputRange: [0.4, 2.2]})}],
        },
      ]}
    />
  );
}

function Star({size, color}: {size: number; color: string}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Path d="M10 0 C11 6 14 9 20 10 C14 11 11 14 10 20 C9 14 6 11 0 10 C6 9 9 6 10 0Z" fill={color} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  layer: {position: 'absolute', top: 0, left: 0},
  shard: {backgroundColor: '#9AA0A6', borderRadius: 2},
  flash: {backgroundColor: '#FFFFFF'},
});
