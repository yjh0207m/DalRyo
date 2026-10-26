import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Animated, Easing, Image, StyleSheet, View, type ImageSourcePropType, type StyleProp, type ViewStyle} from 'react-native';
import {colors} from '../../theme';
import type {CharacterMotion, CharacterStage, CharacterType, OutfitSlot} from '../../types/character.types';
import {resolveCharacterSource} from './characterAssets';

// 캐릭터를 그리는 유일한 진입점. 화면은 이 컴포넌트만 쓰고, 그리는 방식(PNG → Rive 등)은
// 이 파일 안에서만 바꾼다. 옷 레이어는 몸 이미지와 같은 캔버스 크기로 제작된 PNG를 겹쳐 그린다.

type Props = {
  type: CharacterType;
  stage: CharacterStage;
  motion?: CharacterMotion;
  size?: number;
  outfitLayers?: Partial<Record<OutfitSlot, ImageSourcePropType>>;
  style?: StyleProp<ViewStyle>;
};

// 몸 뒤에 그릴 슬롯 / 몸 위에 그릴 슬롯 (아래에서 위 순서)
const BEHIND_BODY: OutfitSlot[] = ['back'];
const OVER_BODY: OutfitSlot[] = ['bottom', 'top', 'shoes', 'hat', 'accessory'];

type MotionSpec = {bob: number; durationMs: number; tiltDeg: number; leanDeg: number};

const MOTION_SPECS: Record<CharacterMotion, MotionSpec | null> = {
  idle: {bob: 4, durationMs: 1200, tiltDeg: 0, leanDeg: 0},
  rest: {bob: 2, durationMs: 1800, tiltDeg: 0, leanDeg: 0},
  slow: {bob: 5, durationMs: 600, tiltDeg: 2, leanDeg: 0},
  run: {bob: 8, durationMs: 320, tiltDeg: 4, leanDeg: 3},
  sprint: {bob: 10, durationMs: 200, tiltDeg: 5, leanDeg: 8},
  stone: null,
};

export function CharacterView({type, stage, motion = 'idle', size = 200, outfitLayers, style}: Props) {
  const source = useCharacterSource(type, stage);
  const progress = useRef(new Animated.Value(0)).current;
  const spec = MOTION_SPECS[motion];

  useEffect(() => {
    progress.stopAnimation();
    progress.setValue(0);

    if (!spec) {
      return undefined;
    }

    const half = spec.durationMs / 2;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {toValue: 1, duration: half, easing: Easing.inOut(Easing.quad), useNativeDriver: true}),
        Animated.timing(progress, {toValue: 0, duration: half, easing: Easing.inOut(Easing.quad), useNativeDriver: true}),
      ]),
    );
    loop.start();

    return () => loop.stop();
  }, [progress, spec]);

  const transform = useMemo(() => {
    if (!spec) {
      return [];
    }

    return [
      {translateY: progress.interpolate({inputRange: [0, 1], outputRange: [0, -spec.bob]})},
      {
        rotate: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [`${spec.leanDeg - spec.tiltDeg}deg`, `${spec.leanDeg + spec.tiltDeg}deg`],
        }),
      },
    ];
  }, [progress, spec]);

  const box = {width: size, height: size};

  return (
    <View style={[box, style]}>
      <Animated.View style={[box, {transform}]}>
        {BEHIND_BODY.map(slot => renderLayer(outfitLayers?.[slot], slot))}
        {source ? (
          <Image source={source} resizeMode="contain" style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[styles.placeholder, {borderRadius: size / 2}]} />
        )}
        {OVER_BODY.map(slot => renderLayer(outfitLayers?.[slot], slot))}
        {motion === 'stone' && source && (
          <Image source={source} resizeMode="contain" style={[StyleSheet.absoluteFill, styles.stoneOverlay]} />
        )}
      </Animated.View>
    </View>
  );
}

function renderLayer(layer: ImageSourcePropType | undefined, slot: OutfitSlot) {
  if (!layer) {
    return null;
  }

  return <Image key={slot} source={layer} resizeMode="contain" style={StyleSheet.absoluteFill} />;
}

function useCharacterSource(type: CharacterType, stage: CharacterStage) {
  const [source, setSource] = useState<ImageSourcePropType | null>(null);

  useEffect(() => {
    let cancelled = false;
    const resolved = resolveCharacterSource(type, stage);

    if (resolved instanceof Promise) {
      setSource(null);
      resolved.then(next => {
        if (!cancelled) setSource(next);
      });
    } else {
      setSource(resolved);
    }

    return () => {
      cancelled = true;
    };
  }, [type, stage]);

  return source;
}

const styles = StyleSheet.create({
  placeholder: {...StyleSheet.absoluteFill, margin: '20%', backgroundColor: colors.primarySoft},
  stoneOverlay: {tintColor: colors.stoneTint, opacity: 0.7},
});
