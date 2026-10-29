import React, { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Flame,
  Infinity as InfinityIcon,
  Route,
  Timer,
  type LucideIcon,
} from 'lucide-react-native';
import { AppText, Button } from '../../components/ui';
import { colors, radius, spacing } from '../../theme';
import type { RunGoalType } from '../../types/run.types';

type Props = {
  visible: boolean;
  onClose: () => void;
  // 자유 달리기는 바로 시작, 나머지는 목표 값 설정 화면으로
  onSelect: (goalType: RunGoalType) => void;
  onParkPress?: () => void;
};

const OPTIONS: Array<{
  type: RunGoalType;
  title: string;
  detail: string;
  icon: LucideIcon;
}> = [
  {
    type: 'free',
    title: '자유 달리기',
    detail: '바로 시작해요',
    icon: InfinityIcon,
  },
  {
    type: 'time',
    title: '시간 목표',
    detail: '몇 분 달릴지 정해요',
    icon: Timer,
  },
  {
    type: 'distance',
    title: '거리 목표',
    detail: '몇 km 달릴지 정해요',
    icon: Route,
  },
  {
    type: 'calorie',
    title: '칼로리 목표',
    detail: '얼마나 태울지 정해요',
    icon: Flame,
  },
];

// 달리기 시작 팝업 (Figma: "페이지가 아니라 큼지막한 팝업 형식으로")
export function RunStartSheet({
  visible,
  onClose,
  onSelect,
  onParkPress,
}: Props) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(400)).current;

  useEffect(() => {
    if (visible) {
      translateY.setValue(400);
      Animated.spring(translateY, {
        toValue: 0,
        friction: 9,
        tension: 70,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, translateY]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.backdrop}
        accessibilityLabel="닫기"
        onPress={onClose}
      />
      <Animated.View
        style={[
          styles.sheet,
          {
            paddingBottom: insets.bottom + spacing.xl,
            transform: [{ translateY }],
          },
        ]}
      >
        <View style={styles.handle} />
        <AppText
          variant="label"
          color={colors.textMuted}
          style={styles.eyebrow}
        >
          LET’S RUN
        </AppText>
        <AppText variant="title">어떻게 달릴까요?</AppText>
        <AppText
          variant="body"
          color={colors.textMuted}
          style={styles.subtitle}
        >
          목표를 정하면 달리는 동안 진행률을 보여 드려요
        </AppText>
        <View style={styles.grid}>
          {OPTIONS.map(option => {
            const featured = option.type === 'free';
            const Icon = option.icon;
            return (
              <Pressable
                key={option.type}
                accessibilityRole="button"
                onPress={() => onSelect(option.type)}
                style={({ pressed }) => [
                  styles.tile,
                  featured && styles.tileFeatured,
                  pressed && styles.tilePressed,
                ]}
              >
                <View
                  style={[styles.tileIcon, featured && styles.tileIconFeatured]}
                >
                  <Icon
                    color={featured ? colors.primary : colors.primaryInk}
                    size={26}
                    strokeWidth={2.2}
                  />
                </View>
                <AppText variant="subheading" color={colors.text}>
                  {option.title}
                </AppText>
                <AppText variant="caption" color={colors.textMuted}>
                  {option.detail}
                </AppText>
              </Pressable>
            );
          })}
        </View>
        {onParkPress && (
          <Button
            label="주변 공원·코스에서 달리기"
            variant="secondary"
            size="md"
            onPress={onParkPress}
            style={styles.parkButton}
          />
        )}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  eyebrow: { fontSize: 10, letterSpacing: 1.5, marginBottom: 6 },
  parkButton: { marginTop: spacing.md },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(10,30,26,0.45)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    marginBottom: spacing.xl,
  },
  subtitle: { marginTop: spacing.xs },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  tile: {
    width: '47.8%',
    minHeight: 144,
    borderRadius: radius.lg,
    padding: spacing.lg,
    backgroundColor: colors.surfaceMuted,
    justifyContent: 'flex-end',
    gap: 2,
  },
  tileFeatured: { backgroundColor: colors.primarySoft },
  tilePressed: { transform: [{ scale: 0.97 }], opacity: 0.92 },
  tileIcon: {
    width: 40,
    height: 40,
    marginBottom: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileIconFeatured: { backgroundColor: colors.surface },
});
