import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { LucideIcon } from 'lucide-react-native';
import { colors, radius, spacing } from '../../theme';
import { AppText } from './AppText';
import { Button } from './Button';

export type ActionSheetItem = {
  label: string;
  // 화면 읽기 기능이 읽을 이름. 없으면 label을 읽는다
  accessibilityLabel?: string;
  icon: LucideIcon;
  danger?: boolean;
  onPress: () => void;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  items: ActionSheetItem[];
};

// iOS에서 닫힘 알림이 오지 않더라도 고른 동작이 사라지지 않게 하는 시간(ms). 닫는 애니메이션보다 길다
const DISMISS_FALLBACK_MS = 600;

// 아래에서 올라오는 목록형 메뉴
export function ActionSheet({ visible, onClose, items }: Props) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(300)).current;
  const pending = useRef<(() => void) | null>(null);
  const fallback = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) return;
    translateY.setValue(300);
    Animated.spring(translateY, {
      toValue: 0,
      friction: 9,
      tension: 70,
      useNativeDriver: true,
    }).start();
  }, [visible, translateY]);
  useEffect(
    () => () => {
      if (fallback.current) clearTimeout(fallback.current);
    },
    [],
  );

  const runPending = () => {
    if (fallback.current) clearTimeout(fallback.current);
    fallback.current = null;
    const action = pending.current;
    pending.current = null;
    action?.();
  };
  const choose = (action: () => void) => {
    // iOS는 Modal이 완전히 닫히기 전에 다른 창(확인 창, 카메라 등)을 띄우면 열리지 않아, 닫힌 뒤(onDismiss)에 실행한다
    if (Platform.OS === 'ios') {
      pending.current = action;
      fallback.current = setTimeout(runPending, DISMISS_FALLBACK_MS);
    }
    onClose();
    if (Platform.OS !== 'ios') action();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
      onDismiss={runPending}
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
            paddingBottom: insets.bottom + spacing.lg,
            transform: [{ translateY }],
          },
        ]}
      >
        <View style={styles.handle} />
        {items.map(item => (
          <Option
            key={item.label}
            item={item}
            onPress={() => choose(item.onPress)}
          />
        ))}
        <Button
          label="취소"
          variant="ghost"
          size="md"
          onPress={onClose}
          style={styles.cancel}
        />
      </Animated.View>
    </Modal>
  );
}

function Option({
  item: { icon: Icon, label, accessibilityLabel, danger },
  onPress,
}: {
  item: ActionSheetItem;
  onPress: () => void;
}) {
  const tint = danger ? colors.danger : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={({ pressed }) => [styles.option, pressed && styles.pressed]}
    >
      <View style={styles.optionIcon}>
        <Icon
          color={danger ? colors.danger : colors.primaryInk}
          size={22}
          strokeWidth={2}
        />
      </View>
      <AppText variant="subheading" color={tint}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
    gap: spacing.xs,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  pressed: { backgroundColor: colors.surfaceMuted },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancel: { marginTop: spacing.sm },
});
