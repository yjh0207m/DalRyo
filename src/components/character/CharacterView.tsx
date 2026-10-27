import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  View,
  type ImageSourcePropType,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, {Ellipse} from 'react-native-svg';
import {colors} from '../../theme';
import type {CharacterMotion, CharacterStage, CharacterType, OutfitSlot} from '../../types/character.types';
import {bundledCharacterRive, bundledCharacterStepMs, resolveCharacterRiveUrl, resolveCharacterSource} from './characterAssets';
import {CharacterEffects} from './CharacterEffects';
import {RiveCharacter} from './RiveCharacter';

// 캐릭터를 그리는 유일한 진입점. 화면은 이 컴포넌트만 쓰고, 그리는 방식은 이 파일 안에서만 바꾼다.
//
// 준비된 동물·단계는 번들 또는 원격 Rive로 그린다. 나머지는 PNG 한 장을 '스티커'처럼 통째로만 움직인다.
// 몸을 늘리거나 접으면 입체 일러스트가 고무처럼 보이므로, 움직임은 아주 작게 두고 생동감은 주변 효과로 낸다.
//   - 대기: 느린 숨쉬기(1.5% 이내), 알은 가끔 흔들림
//   - 달리기: 살짝 앞으로 기울인 채 걸음 박자에 맞춰 아주 작게 들썩 + 흙먼지·땀방울·속도선(CharacterEffects)
//   - 방향 전환(facing), 탭 반응(jumpKey → 톡 튀었다 돌아오기)
// Rive에서는 내부 리깅이 몸·점프를 맡고 이 컴포넌트는 방향·그림자·먼지를 그린다.

type Props = {
  type: CharacterType;
  stage: CharacterStage;
  motion?: CharacterMotion;
  size?: number;
  facing?: 'left' | 'right';
  // 값이 바뀔 때마다 한 번 크게 점프한다 (탭 반응 등)
  jumpKey?: number;
  // 달릴 때 발밑 흙먼지
  dust?: boolean;
  // 달릴 때 땀방울·속도선 (작은 아바타에서는 자동으로 끈다)
  effects?: boolean;
  outfitLayers?: Partial<Record<OutfitSlot, ImageSourcePropType>>;
  // 발밑 그림자. 캐릭터가 바닥에 서 있는 느낌을 준다 (작은 아바타에서는 끈다)
  grounded?: boolean;
  // 개발 화면에서만 미검수 동작 후보를 비교한다. 일반 화면에는 전달하지 않는다.
  previewRiveSource?: number;
  style?: StyleProp<ViewStyle>;
};

// 몸 뒤에 그릴 슬롯 / 몸 위에 그릴 슬롯 (아래에서 위 순서)
const BEHIND_BODY: OutfitSlot[] = ['back'];
const OVER_BODY: OutfitSlot[] = ['bottom', 'top', 'shoes', 'hat', 'accessory'];

// 캐릭터 PNG에서 발이 닿는 높이(위에서부터 비율). 찌그러짐·그림자의 기준점
const FEET_RATIO = 0.82;
// 이보다 작게 그릴 때는 효과가 캐릭터를 가려 끈다
const EFFECTS_MIN_SIZE = 110;

type Keyframes = {
  durationMs: number;
  t: number[];
  y: number[]; // size 대비 비율, 음수가 위
  scaleY: number[];
  scaleX: number[];
  rotate: number[]; // deg
  shadow: number[]; // 그림자 가로 배율
};

// 한 걸음 = 아주 작은 들썩임. 모양은 그대로 두고 위치·기울기만 조금 바뀐다
function pace(durationMs: number, bob: number, lean: number): Keyframes {
  return {
    durationMs,
    t: [0, 0.25, 0.5, 0.75, 1],
    y: [0, -0.7, -1, -0.7, 0].map(v => v * bob),
    scaleY: [1, 1, 1, 1, 1],
    scaleX: [1, 1, 1, 1, 1],
    rotate: [lean, lean + 0.6, lean, lean - 0.6, lean],
    shadow: [1, 0.97, 0.95, 0.97, 1],
  };
}

function breathe(durationMs: number, amount: number): Keyframes {
  return {
    durationMs,
    t: [0, 0.5, 1],
    y: [0, 0, 0],
    scaleY: [1, 1 + amount, 1],
    scaleX: [1, 1 - amount * 0.4, 1],
    rotate: [0, 0, 0],
    shadow: [1, 0.97, 1],
  };
}

// 알: 대부분 가만히 있다가 가끔 좌우로 톡톡 흔들린다
const EGG_WOBBLE: Keyframes = {
  durationMs: 2800,
  t: [0, 0.62, 0.68, 0.74, 0.8, 0.86, 1],
  y: [0, 0, -0.01, 0, -0.01, 0, 0],
  scaleY: [1, 1, 1.02, 0.98, 1.02, 1, 1],
  scaleX: [1, 1, 0.99, 1.01, 0.99, 1, 1],
  rotate: [0, 0, -7, 6, -4, 0, 0],
  shadow: [1, 1, 0.97, 1, 0.97, 1, 1],
};

const MOTIONS: Record<CharacterMotion, Keyframes | null> = {
  idle: breathe(3400, 0.015),
  rest: breathe(4200, 0.01),
  slow: pace(560, 0.006, 1.5),
  run: pace(400, 0.01, 3),
  sprint: pace(320, 0.014, 5),
  stone: null,
};

// 탭 반응: 살짝 커지며 떴다가 → 조금 눌렸다가 → 제자리
const POP = {durationMs: 560, t: [0, 0.16, 0.42, 0.68, 1], scale: [1, 1.09, 0.96, 1.02, 1], y: [0, -0.05, 0, 0, 0]};

const RUNNING: CharacterMotion[] = ['slow', 'run', 'sprint'];

export function CharacterView({
  type,
  stage,
  motion = 'idle',
  size = 200,
  facing = 'right',
  jumpKey,
  dust = false,
  effects = true,
  outfitLayers,
  grounded = true,
  previewRiveSource,
  style,
}: Props) {
  const source = useCharacterSource(type, stage);
  // 외부 의상 레이어는 PNG 경로에서 합성한다. 기본/돌 상태는 Rive 내부 재질을 쓴다.
  const pngOnly = Object.values(outfitLayers ?? {}).some(Boolean);
  const resolvedRiveSource = useRiveSource(type, stage, pngOnly);
  const riveSource = __DEV__ && previewRiveSource !== undefined && stage !== 'egg' && motion !== 'stone' && !pngOnly
    ? previewRiveSource : resolvedRiveSource;
  const riveKey = `${type}/${stage}/${riveSource}`;
  const [failedRiveKey, setFailedRiveKey] = useState<string | null>(null);
  // Rive 파일이 있으면 몸의 움직임(점프 포함)은 Rive가 맡고, 아래 PNG 절차 애니메이션은 끈다
  const riveStage = stage !== 'egg' && riveSource !== null && failedRiveKey !== riveKey ? stage : null;
  const phase = useRef(new Animated.Value(0)).current;
  const jump = useRef(new Animated.Value(0)).current;
  const frames = riveStage ? null : stage === 'egg' && motion !== 'stone' ? EGG_WOBBLE : MOTIONS[motion];

  useEffect(() => {
    phase.stopAnimation();
    phase.setValue(0);

    if (!frames) {
      return undefined;
    }

    const loop = Animated.loop(Animated.timing(phase, {toValue: 1, duration: frames.durationMs, easing: Easing.linear, useNativeDriver: true}));
    loop.start();
    return () => loop.stop();
  }, [phase, frames]);

  // 탭 등 외부 트리거: 톡 튀었다 돌아온다
  useEffect(() => {
    if (riveStage) {
      jump.stopAnimation();
      jump.setValue(0);
      return;
    }
    if (jumpKey === undefined || jumpKey === 0) {
      return;
    }
    jump.setValue(0);
    Animated.timing(jump, {toValue: 1, duration: POP.durationMs, easing: Easing.linear, useNativeDriver: true}).start();
  }, [jumpKey, jump, riveStage]);

  const animated = useMemo(() => {
    const popRange = {inputRange: POP.t};
    const pop = jump.interpolate({...popRange, outputRange: POP.scale});
    const popY = jump.interpolate({...popRange, outputRange: POP.y.map(v => v * size)});
    const popShadow = jump.interpolate({...popRange, outputRange: [1, 0.9, 1.04, 1, 1]});

    if (!frames) {
      return {body: [{translateY: popY}, {scale: pop}], shadow: popShadow};
    }

    // 크기·기울기의 기준점은 발(transformOrigin)이라 숨쉬거나 기울어도 발이 뜨지 않는다
    const range = {inputRange: frames.t};
    const loopY = phase.interpolate({...range, outputRange: frames.y.map(v => v * size)});

    return {
      body: [
        {translateY: Animated.add(loopY, popY)},
        {rotate: phase.interpolate({...range, outputRange: frames.rotate.map(d => `${facing === 'left' ? -d : d}deg`)})},
        {scaleX: Animated.multiply(phase.interpolate({...range, outputRange: frames.scaleX}), pop)},
        {scaleY: Animated.multiply(phase.interpolate({...range, outputRange: frames.scaleY}), pop)},
      ],
      shadow: Animated.multiply(phase.interpolate({...range, outputRange: frames.shadow}), popShadow),
    };
  }, [frames, phase, jump, size, facing]);

  const box = {width: size, height: size};
  // Image는 absoluteFill만으로는 크기가 잡히지 않아(Android) 모든 레이어에 명시적 크기를 준다
  const layer = [styles.layer, box];
  const flip = facing === 'left' ? styles.flipped : null;

  const groundShadow = {
    left: size * 0.3,
    top: size * FEET_RATIO,
    width: size * 0.4,
    height: Math.max(3, size * 0.045),
    borderRadius: size,
  };

  return (
    <View style={[box, style]}>
      {grounded && <Animated.View style={[styles.groundShadow, groundShadow, {transform: [{scaleX: animated.shadow}]}]}>
        <Svg width={groundShadow.width} height={groundShadow.height}>
          <Ellipse cx={groundShadow.width / 2} cy={groundShadow.height / 2} rx={groundShadow.width / 2} ry={groundShadow.height / 2} fill="rgba(16,24,20,0.08)" />
        </Svg>
      </Animated.View>}
      {dust && RUNNING.includes(motion) && <DustTrail size={size} facing={facing} intervalMs={(riveStage ? bundledCharacterStepMs(type, stage, motion) : null) ?? MOTIONS[motion]?.durationMs ?? 400} />}
      {effects && size >= EFFECTS_MIN_SIZE && <CharacterEffects motion={motion} size={size} facing={facing} />}
      <Animated.View style={[box, {transformOrigin: [size / 2, size * FEET_RATIO, 0], transform: animated.body}]}>
        <View style={[box, flip]}>
          {riveSource !== null && riveStage ? (
            // 옷은 Rive 파일 안의 교체 가능한 이미지(referenced asset)로 입힌다 — 규격 문서 참고
            <RiveCharacter key={riveKey} source={riveSource} stage={riveStage} motion={motion} jumpKey={jumpKey} style={box} onError={() => setFailedRiveKey(riveKey)} />
          ) : (
            <>
              {BEHIND_BODY.map(slot => renderLayer(outfitLayers?.[slot], slot, layer))}
              {source ? (
                <Image source={source} resizeMode="contain" style={layer} />
              ) : (
                <View style={[styles.placeholder, {borderRadius: size / 2}]} />
              )}
              {OVER_BODY.map(slot => renderLayer(outfitLayers?.[slot], slot, layer))}
              {motion === 'stone' && source && <Image source={source} resizeMode="contain" style={[layer, styles.stoneOverlay]} />}
            </>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

// 발뒤꿈치 뒤로 흩어지는 흙먼지 3개. 걸음 박자에 맞춰 번갈아 피어오른다
function DustTrail({size, facing, intervalMs}: {size: number; facing: 'left' | 'right'; intervalMs: number}) {
  const puffs = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const loops = puffs.map((value, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay((intervalMs * index) / puffs.length),
          Animated.timing(value, {toValue: 1, duration: intervalMs * 1.6, easing: Easing.out(Easing.quad), useNativeDriver: true}),
          Animated.timing(value, {toValue: 0, duration: 0, useNativeDriver: true}),
        ]),
      ),
    );
    loops.forEach(loop => loop.start());
    return () => loops.forEach(loop => loop.stop());
  }, [puffs, intervalMs]);

  const direction = facing === 'right' ? -1 : 1;
  const puffSize = size * 0.09;

  return (
    <>
      {puffs.map((value, index) => (
        <Animated.View
          key={index}
          pointerEvents="none"
          style={[
            styles.dust,
            {
              width: puffSize,
              height: puffSize,
              borderRadius: puffSize,
              left: size / 2 - puffSize / 2 + direction * size * 0.12,
              top: size * FEET_RATIO - puffSize * 0.8,
              opacity: value.interpolate({inputRange: [0, 0.15, 1], outputRange: [0, 0.85, 0]}),
              transform: [
                {translateX: value.interpolate({inputRange: [0, 1], outputRange: [0, direction * size * 0.28]})},
                {translateY: value.interpolate({inputRange: [0, 1], outputRange: [0, -size * 0.06 * (index + 1)]})},
                {scale: value.interpolate({inputRange: [0, 1], outputRange: [0.4, 1.4]})},
              ],
            },
          ]}
        />
      ))}
    </>
  );
}

function renderLayer(source: ImageSourcePropType | undefined, slot: OutfitSlot, style: StyleProp<ImageStyle>) {
  if (!source) {
    return null;
  }

  return <Image key={slot} source={source} resizeMode="contain" style={style} />;
}

// 준비된 로컬 단계 우선, 그 외는 원격 파일. 알·외부 의상은 PNG.
function useRiveSource(type: CharacterType, stage: CharacterStage, pngOnly: boolean) {
  const bundled = bundledCharacterRive(type, stage);
  const key = `${type}/${stage}`;
  const [remote, setRemote] = useState<{key: string; url: string | null} | null>(null);

  useEffect(() => {
    if (stage === 'egg' || bundled !== null || pngOnly) {
      return undefined;
    }

    let cancelled = false;
    resolveCharacterRiveUrl(type).then(next => {
      if (!cancelled) setRemote({key, url: next});
    });
    return () => {
      cancelled = true;
    };
  }, [type, stage, key, bundled, pngOnly]);

  if (stage === 'egg' || pngOnly) return null;
  return bundled ?? (remote?.key === key ? remote.url : null);
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
  layer: {position: 'absolute', top: 0, left: 0},
  flipped: {transform: [{scaleX: -1}]},
  groundShadow: {position: 'absolute'},
  // 풀밭·하늘 어느 쪽에서도 보이도록 밝은 흰색 먼지
  dust: {position: 'absolute', backgroundColor: '#FFFFFF'},
  placeholder: {...StyleSheet.absoluteFill, margin: '20%', backgroundColor: colors.primarySoft},
  stoneOverlay: {tintColor: colors.stoneTint, opacity: 0.7},
});
