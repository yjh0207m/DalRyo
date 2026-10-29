import React, {useEffect, useRef, useState} from 'react';
import {Animated, Image, StyleSheet, View} from 'react-native';
import {Flash, ShardBurst, SparkleBurst, SunRays} from '../celebrate/Bursts';
import type {CharacterStage, CharacterType, EquippedOutfit} from '../../types/character.types';
import type {RevealMode} from '../../utils/reveal';
import {CharacterView, useCharacterSource} from './CharacterView';

// 달리기 완료 화면의 캐릭터 등장 연출. 그림을 늘리거나 접지 않고, 등장·번쩍임·실루엣 교차·효과로만 보여 준다.
//   complete: 톡 등장 + 반짝임
//   hatch:    알이 점점 세게 흔들림 → 번쩍 → 깨진 껍데기 속에서 등장 + 빛줄기
//   grow:     이전 모습 → 하얀 실루엣으로 변해 이전/다음 모습이 점점 빠르게 번갈아 → 번쩍 → 새 모습 + 빛줄기
//   thaw:     돌 상태로 부르르 → 조각이 튀며 원래 색으로 톡
// 끝나면 onRevealed(big) — big이면 화면이 색종이를 뿌린다.

export type {RevealMode} from '../../utils/reveal';

type Props = {
  mode: RevealMode;
  equipped?: EquippedOutfit;
  type: CharacterType;
  stageBefore: CharacterStage;
  stageAfter: CharacterStage;
  size: number;
  onRevealed: (big: boolean) => void;
};

const images = {
  egg: require('../../assets/images/egg.png'),
  brokenEgg: require('../../assets/images/broken_egg.png'),
};

// 실루엣이 이전/다음 모습으로 바뀌는 간격 — 점점 빨라진다. 마지막은 다음 모습
const SWAPS_MS = [340, 280, 220, 180, 150, 120, 100, 90];
const FEET = 0.82;

type Phase = 'before' | 'silhouette' | 'after';

export function CharacterReveal({mode, type, stageBefore, stageAfter, size, onRevealed, equipped}: Props) {
  const [phase, setPhase] = useState<Phase>(mode === 'complete' ? 'after' : 'before');
  const [flashKey, setFlashKey] = useState(0);
  const [popKey, setPopKey] = useState(0);
  const enter = useRef(new Animated.Value(mode === 'complete' ? 0 : 1)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const swap = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const done = useRef(onRevealed);
  done.current = onRevealed;

  useEffect(() => {
    let cancelled = false;
    const finish = (big: boolean) => !cancelled && done.current(big);
    const reveal = (big: boolean) => {
      if (cancelled) return;
      setFlashKey(k => k + 1);
      setPhase('after');
      pop.setValue(0);
      Animated.spring(pop, {toValue: 1, friction: 5, tension: 90, useNativeDriver: true}).start();
      setTimeout(() => finish(big), 350);
    };

    if (mode === 'complete') {
      Animated.spring(enter, {toValue: 1, friction: 6, tension: 80, useNativeDriver: true}).start();
      const timer = setTimeout(() => finish(false), 500);
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }

    if (mode === 'hatch' || mode === 'thaw') {
      // 흔들림이 점점 세게
      const round = (amp: number, times: number) =>
        Animated.loop(
          Animated.sequence([
            Animated.timing(shake, {toValue: amp, duration: 70, useNativeDriver: true}),
            Animated.timing(shake, {toValue: -amp, duration: 70, useNativeDriver: true}),
            Animated.timing(shake, {toValue: 0, duration: 70, useNativeDriver: true}),
          ]),
          {iterations: times},
        );
      // 부화는 큰 순간이라 길게(약 3.7초), 해동은 짧게(약 2.2초)
      const seq =
        mode === 'hatch'
          ? Animated.sequence([Animated.delay(400), round(0.4, 3), Animated.delay(350), round(0.7, 4), Animated.delay(250), round(1, 6)])
          : Animated.sequence([Animated.delay(300), round(0.5, 3), Animated.delay(250), round(1, 5)]);
      seq.start(({finished}) => {
        if (!finished) return;
        if (mode === 'thaw') setPopKey(k => k + 1);
        reveal(mode === 'hatch');
      });
      return () => {
        cancelled = true;
        seq.stop();
      };
    }

    // grow
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(
      setTimeout(() => {
        if (cancelled) return;
        setPhase('silhouette');
        let at = 0;
        SWAPS_MS.forEach((ms, i) => {
          at += ms;
          timers.push(setTimeout(() => swap.setValue(i % 2 === 0 ? 1 : 0), at));
        });
        timers.push(setTimeout(() => reveal(true), at + 160));
      }, 800),
    );
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [mode, enter, shake, swap, pop]);

  const box = {width: size, height: size};
  const big = mode !== 'complete';
  const rays = size * 1.35;
  const shakeRotate = shake.interpolate({inputRange: [-1, 1], outputRange: ['-12deg', '12deg']});
  const shakeX = shake.interpolate({inputRange: [-1, 1], outputRange: [-5, 5]});

  return (
    <View style={box}>
      {big && phase !== 'before' && mode !== 'thaw' && (
        <View pointerEvents="none" style={[styles.raysWrap, {left: (size - rays) / 2, top: size * 0.5 - rays / 2, width: rays, height: rays}]}>
          <SunRays size={rays} />
        </View>
      )}

      {/* 등장 전 */}
      {phase === 'before' && mode === 'hatch' && (
        <Animated.View style={[styles.egg, {left: (size - 150) / 2, top: size * FEET - 162, transform: [{rotate: shakeRotate}]}]}>
          <Image source={images.egg} resizeMode="contain" style={styles.eggImage} />
        </Animated.View>
      )}
      {phase === 'before' && mode === 'thaw' && (
        <Animated.View style={{transform: [{translateX: shakeX}]}}>
          <CharacterView equipped={equipped} type={type} stage={stageAfter} motion="stone" size={size} />
        </Animated.View>
      )}
      {phase === 'before' && mode === 'grow' && <CharacterView equipped={equipped} type={type} stage={stageBefore} motion="idle" size={size} />}
      {phase === 'silhouette' && <Silhouettes type={type} before={stageBefore} after={stageAfter} size={size} swap={swap} />}

      {/* 등장 후 */}
      {phase === 'after' && (
        <Animated.View
          style={{
            transformOrigin: [size / 2, size * FEET, 0],
            transform: [
              {translateY: enter.interpolate({inputRange: [0, 1], outputRange: [size * 0.12, 0]})},
              {scale: Animated.multiply(enter.interpolate({inputRange: [0, 1], outputRange: [0.6, 1]}), pop)},
            ],
            opacity: enter.interpolate({inputRange: [0, 0.3, 1], outputRange: [0, 1, 1]}),
          }}
        >
          <CharacterView equipped={equipped} type={type} stage={stageAfter} motion="idle" size={size} jumpKey={popKey} grounded={mode !== 'hatch'} />
        </Animated.View>
      )}
      {phase === 'after' && mode === 'hatch' && (
        // 깨진 껍데기를 캐릭터 아랫부분에 겹쳐, 껍데기에서 막 나온 모습으로 보이게 한다
        <Image source={images.brokenEgg} resizeMode="contain" style={[styles.brokenEgg, {left: (size - 170) / 2, top: size * FEET - 78}]} />
      )}

      {phase === 'after' && mode === 'complete' && <SparkleBurst size={size} />}
      {phase === 'after' && mode === 'thaw' && <ShardBurst size={size} />}
      {phase === 'after' && mode === 'thaw' && <SparkleBurst size={size} color="#FFFFFF" />}
      {flashKey > 0 && (
        <View pointerEvents="none" style={[styles.center, box]}>
          <Flash key={flashKey} size={size * 0.7} />
        </View>
      )}
    </View>
  );
}

// 하얀 실루엣 두 장(이전·다음 단계)을 번갈아 보여 준다. 다음 단계가 조금 더 크다
function Silhouettes({type, before, after, size, swap}: {type: CharacterType; before: CharacterStage; after: CharacterStage; size: number; swap: Animated.Value}) {
  const beforeSource = useCharacterSource(type, before);
  const afterSource = useCharacterSource(type, after);
  const box = {width: size, height: size};
  return (
    <View style={box}>
      {beforeSource && (
        <Animated.Image
          source={beforeSource}
          resizeMode="contain"
          style={[styles.layer, box, styles.silhouette, {opacity: swap.interpolate({inputRange: [0, 1], outputRange: [1, 0]})}]}
        />
      )}
      {afterSource && (
        <Animated.Image
          source={afterSource}
          resizeMode="contain"
          style={[styles.layer, box, styles.silhouette, {opacity: swap, transformOrigin: [size / 2, size * FEET, 0], transform: [{scale: 1.08}]}]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {position: 'absolute', top: 0, left: 0},
  center: {position: 'absolute', top: 0, left: 0, alignItems: 'center', justifyContent: 'center'},
  raysWrap: {position: 'absolute'},
  // 흔들림 기준점은 알 바닥
  egg: {position: 'absolute', width: 150, height: 174, transformOrigin: 'bottom'},
  eggImage: {width: 150, height: 174},
  brokenEgg: {position: 'absolute', width: 170, height: 122},
  silhouette: {tintColor: '#FFFFFF'},
});
