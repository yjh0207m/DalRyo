import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { Heart, Music, Sparkles, type LucideIcon } from 'lucide-react-native';
import { colors } from '../../theme';
import type {
  CharacterStage,
  CharacterType,
  EquippedOutfit,
} from '../../types/character.types';
import { CharacterView } from './CharacterView';
import { SpeechBubble } from './SpeechBubble';

// 홈 "로비"의 캐릭터. 제자리에서 숨쉬고, 가끔 스스로 작은 행동을 하며, 탭하면 반응한다.
//   혼자 있을 때(8~12초마다): 뒤돌아보기(카드 뒤집듯 방향 전환) 또는 머리 위로 ♪/반짝임
//   탭: 톡 튀기 + 하트 두 개 + 말풍선 대사 변경
// 그림을 늘리거나 걷게 하지 않는다 — 한 장짜리 일러스트는 통째로 움직일 때 가장 자연스럽다.
// 알·돌 상태는 혼자 행동하지 않는다.

type Props = {
  type: CharacterType;
  stage: CharacterStage;
  size: number;
  frozen?: boolean;
  speech?: string;
  tapLines?: string[];
  equipped?: EquippedOutfit;
  bubblePlacement?: 'above' | 'beside';
};

type Particle = {
  id: number;
  value: Animated.Value;
  dx: number;
  icon: LucideIcon;
  color: string;
};

const EMOTES: Array<{ icon: LucideIcon; color: string }> = [
  { icon: Music, color: colors.primary },
  { icon: Sparkles, color: colors.gold },
];

export function LobbyCharacter({
  type,
  stage,
  size,
  frozen = false,
  speech,
  tapLines = [],
  equipped,
  bubblePlacement = 'above',
}: Props) {
  const turn = useRef(new Animated.Value(1)).current;
  const facingRef = useRef(1);
  const [jumpKey, setJumpKey] = useState(0);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [line, setLine] = useState<string | undefined>(speech);
  const alive = !frozen && stage !== 'egg';
  const nextId = useRef(0);

  useEffect(() => setLine(speech), [speech]);

  const burst = useCallback(
    (icon: LucideIcon, color: string, dx: number, delayMs = 0) => {
      const particle: Particle = {
        id: nextId.current++,
        value: new Animated.Value(0),
        dx,
        icon,
        color,
      };
      setParticles(current => [...current.slice(-5), particle]);
      Animated.sequence([
        Animated.delay(delayMs),
        Animated.timing(particle.value, {
          toValue: 1,
          duration: 1000,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(() =>
        setParticles(current =>
          current.filter(item => item.id !== particle.id),
        ),
      );
    },
    [],
  );

  // 혼자 있을 때의 작은 행동
  useEffect(() => {
    if (!alive) {
      turn.setValue(1);
      facingRef.current = 1;
      return undefined;
    }
    let timer: ReturnType<typeof setTimeout>;
    let step = 0;
    const act = () => {
      if (step % 2 === 0) {
        facingRef.current = -facingRef.current;
        Animated.timing(turn, {
          toValue: facingRef.current,
          duration: 340,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }).start();
      } else {
        const emote = EMOTES[Math.floor(step / 2) % EMOTES.length];
        setJumpKey(key => key + 1);
        burst(emote.icon, emote.color, size * 0.3 * facingRef.current);
      }
      step += 1;
      timer = setTimeout(act, 8000 + Math.random() * 4000);
    };
    timer = setTimeout(act, 6000);
    return () => clearTimeout(timer);
  }, [alive, burst, size, turn]);

  const onTap = useCallback(() => {
    setJumpKey(key => key + 1);
    if (tapLines.length > 0) {
      setLine(tapLines[Math.floor(Math.random() * tapLines.length)]);
    }
    if (stage === 'egg') return;
    // 말풍선을 가리지 않도록 머리 양옆에서 비스듬히 떠오른다
    burst(Heart, colors.heart, -size * 0.32);
    burst(Heart, colors.heart, size * 0.3, 140);
  }, [burst, size, stage, tapLines]);

  return (
    <View style={[styles.actor, { width: size, height: size }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="캐릭터 쓰다듬기"
        onPress={onTap}
      >
        {/* 방향 전환은 그림을 바꿔 그리지 않고 카드처럼 가로로 뒤집는다 */}
        <Animated.View style={{ transform: [{ scaleX: turn }] }}>
          <CharacterView
            type={type}
            stage={stage}
            motion={frozen ? 'stone' : 'idle'}
            jumpKey={jumpKey}
            size={size}
            equipped={equipped}
          />
        </Animated.View>
      </Pressable>

      {line && (
        <SpeechBubble
          text={line}
          style={
            bubblePlacement === 'above'
              ? { bottom: size * 0.98 }
              : {
                  bottom: size * 0.58,
                  left: -size * 0.42,
                  maxWidth: size * 0.66,
                }
          }
        />
      )}

      {particles.map(({ id, value, dx, icon: Icon, color }) => (
        <Animated.View
          key={id}
          pointerEvents="none"
          style={[
            styles.particle,
            {
              left: size / 2 - 12 + dx,
              top: size * 0.3,
              opacity: value.interpolate({
                inputRange: [0, 0.15, 0.7, 1],
                outputRange: [0, 1, 1, 0],
              }),
              transform: [
                {
                  translateX: value.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, Math.sign(dx) * size * 0.08],
                  }),
                },
                {
                  translateY: value.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -size * 0.26],
                  }),
                },
                {
                  scale: value.interpolate({
                    inputRange: [0, 0.25, 1],
                    outputRange: [0.3, 1.15, 0.9],
                  }),
                },
              ],
            },
          ]}
        >
          <Icon
            color={color}
            fill={Icon === Heart ? color : 'none'}
            size={24}
            strokeWidth={2.4}
          />
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  actor: { alignSelf: 'center', alignItems: 'center' },
  particle: { position: 'absolute' },
});
