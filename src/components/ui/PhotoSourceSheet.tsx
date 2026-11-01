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
import {
  Camera,
  Image as ImageIcon,
  Trash2,
  type LucideIcon,
} from 'lucide-react-native';
import { colors, radius, spacing } from '../../theme';
import { AppText } from './AppText';
import { Button } from './Button';

type Props = {
  visible: boolean;
  onClose: () => void;
  onCamera: () => void;
  onAlbum: () => void;
  // 이미 고른 사진이 있을 때만 넘긴다. 있으면 '사진 삭제' 항목이 나온다
  onRemove?: () => void;
};

// 사진 촬영 / 앨범에서 선택을 고르는 하단 시트
export function PhotoSourceSheet({
  visible,
  onClose,
  onCamera,
  onAlbum,
  onRemove,
}: Props) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(300)).current;
  const pending = useRef<(() => void) | null>(null);

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

  const choose = (action: () => void) => {
    // iOS는 Modal이 완전히 닫히기 전에 카메라·앨범 화면을 띄우면 열리지 않아, 닫힌 뒤(onDismiss)에 실행한다
    if (Platform.OS === 'ios') pending.current = action;
    onClose();
    if (Platform.OS !== 'ios') action();
  };
  const runPending = () => {
    const action = pending.current;
    pending.current = null;
    action?.();
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
        <Option
          icon={Camera}
          label="사진 촬영"
          onPress={() => choose(onCamera)}
        />
        <Option
          icon={ImageIcon}
          label="앨범에서 선택"
          onPress={() => choose(onAlbum)}
        />
        {onRemove && (
          <Option
            icon={Trash2}
            label="사진 삭제"
            danger
            onPress={() => choose(onRemove)}
          />
        )}
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
  icon: Icon,
  label,
  danger,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  danger?: boolean;
  onPress: () => void;
}) {
  const tint = danger ? colors.danger : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
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
