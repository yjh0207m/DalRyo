import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import type {LucideIcon} from 'lucide-react-native';
import {colors} from '../../theme';

type Props = {
  icon: LucideIcon;
  onPress: () => void;
  accessibilityLabel: string;
  // plain: 배경 없이 아이콘만 (헤더 뒤로가기·닫기 등)
  variant?: 'surface' | 'plain';
  size?: number;
  dot?: boolean;
  disabled?: boolean;
};

export function IconButton({icon: Icon, onPress, accessibilityLabel, variant = 'surface', size = 44, dot, disabled = false}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{disabled}}
      disabled={disabled}
      hitSlop={8}
      onPress={onPress}
      style={({pressed}) => [
        {width: size, height: size, borderRadius: size / 2},
        styles.base,
        variant === 'surface' && styles.surface,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}>
      <Icon color={colors.text} size={22} strokeWidth={2} />
      {dot && <View pointerEvents="none" style={styles.dot} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {alignItems: 'center', justifyContent: 'center'},
  surface: {backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border},
  pressed: {backgroundColor: colors.surfaceMuted},
  disabled: {opacity: 0.45},
  dot: {position: 'absolute', top: 10, right: 11, width: 7, height: 7, borderRadius: 4, backgroundColor: colors.danger},
});
