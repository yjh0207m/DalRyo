import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Animated, Easing, Pressable, StyleSheet, View} from 'react-native';
import {Heart} from 'lucide-react-native';
import {colors, radius, shadow, spacing} from '../../theme';
import type {CharacterMotion, CharacterStage, CharacterType} from '../../types/character.types';
import {AppText} from '../ui';
import {CharacterView} from './CharacterView';

// 홈 "로비"의 캐릭터. 게임 속 펫처럼 스스로 돌아다니고, 탭하면 반응한다.
//   쉬기(2~4초) → 아무 곳으로 깡충깡충 이동(방향 전환) → 쉬기 … 반복
//   탭 → 점프 + 하트 + 말풍선 대사 변경
// 알·돌 상태는 돌아다니지 않는다.

type Props = {
  type: CharacterType;
  stage: CharacterStage;
  size: number;
  // 돌아다닐 수 있는 가로 폭
  areaWidth: number;
  frozen?: boolean;
  speech?: string;
  tapLines?: string[];
};

const WALK_PX_PER_MS = 0.07;

type HeartParticle = {id: number; value: Animated.Value; dx: number};

export function WanderingCharacter({type, stage, size, areaWidth, frozen = false, speech, tapLines = []}: Props) {
  const x = useRef(new Animated.Value(0)).current;
  const xRef = useRef(0);
  const [motion, setMotion] = useState<CharacterMotion>(frozen ? 'stone' : 'idle');
  const [facing, setFacing] = useState<'left' | 'right'>('right');
  const [jumpKey, setJumpKey] = useState(0);
  const [hearts, setHearts] = useState<HeartParticle[]>([]);
  const [line, setLine] = useState<string | undefined>(speech);
  const canWander = !frozen && stage !== 'egg';
  const range = Math.max(0, (areaWidth - size) / 2);

  useEffect(() => setLine(speech), [speech]);
  useEffect(() => setMotion(frozen ? 'stone' : 'idle'), [frozen]);

  useEffect(() => {
    if (!canWander || range === 0) {
      return undefined;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const rest = () => {
      if (cancelled) return;
      setMotion('idle');
      timer = setTimeout(walk, 2000 + Math.random() * 2500);
    };

    const walk = () => {
      if (cancelled) return;
      let target = (Math.random() * 2 - 1) * range;
      if (Math.abs(target - xRef.current) < 40) {
        target = xRef.current > 0 ? -range * 0.6 : range * 0.6;
      }
      setFacing(target > xRef.current ? 'right' : 'left');
      setMotion('slow');
      Animated.timing(x, {
        toValue: target,
        duration: Math.abs(target - xRef.current) / WALK_PX_PER_MS,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }).start(({finished}) => {
        if (finished) xRef.current = target;
        rest();
      });
    };

    timer = setTimeout(walk, 1500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      x.stopAnimation(value => {
        xRef.current = value;
      });
    };
  }, [canWander, range, x]);

  const onTap = useCallback(() => {
    setJumpKey(key => key + 1);
    if (tapLines.length > 0) {
      setLine(tapLines[Math.floor(Math.random() * tapLines.length)]);
    }

    const particle: HeartParticle = {id: Date.now(), value: new Animated.Value(0), dx: (Math.random() - 0.5) * size * 0.5};
    setHearts(current => [...current.slice(-4), particle]);
    Animated.timing(particle.value, {toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true}).start(() => {
      setHearts(current => current.filter(heart => heart.id !== particle.id));
    });
  }, [size, tapLines]);

  return (
    <View style={[styles.area, {width: areaWidth, height: size}]}>
      <Animated.View style={[styles.actor, {width: size, height: size, transform: [{translateX: x}]}]}>
        <Pressable accessibilityRole="button" accessibilityLabel="캐릭터 쓰다듬기" onPress={onTap}>
          <CharacterView type={type} stage={stage} motion={motion} facing={facing} jumpKey={jumpKey} size={size} />
        </Pressable>

        {hearts.map(heart => (
          <Animated.View
            key={heart.id}
            pointerEvents="none"
            style={[
              styles.heart,
              {
                left: size / 2 - 12 + heart.dx,
                top: size * 0.2,
                opacity: heart.value.interpolate({inputRange: [0, 0.7, 1], outputRange: [1, 1, 0]}),
                transform: [
                  {translateY: heart.value.interpolate({inputRange: [0, 1], outputRange: [0, -size * 0.45]})},
                  {scale: heart.value.interpolate({inputRange: [0, 0.2, 1], outputRange: [0.3, 1.2, 0.9]})},
                ],
              },
            ]}>
            <Heart color={colors.heart} fill={colors.heart} size={24} />
          </Animated.View>
        ))}

        {line && (
          // 점프(키의 약 1/3)해도 머리를 가리지 않는 높이
          <View pointerEvents="none" style={[styles.bubble, {bottom: size * 1.08}]}>
            <AppText variant="caption" color={colors.text} numberOfLines={2}>
              {line}
            </AppText>
            <View style={styles.tail} />
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  area: {alignSelf: 'center', alignItems: 'center'},
  actor: {alignItems: 'center'},
  heart: {position: 'absolute'},
  bubble: {
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: 180,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  tail: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: -6,
    width: 12,
    height: 12,
    backgroundColor: colors.surface,
    transform: [{rotate: '45deg'}],
  },
});
