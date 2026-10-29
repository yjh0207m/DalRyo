import React from 'react';
import {
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { colors, radius, spacing } from '../../theme';
import { AppText } from './AppText';
type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'lg' | 'md';
  icon?: LucideIcon;
  trailingIcon?: LucideIcon;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon: Icon,
  trailingIcon: TrailingIcon,
  disabled,
  style,
}: Props) {
  const tint =
    variant === 'primary'
      ? colors.textOnPrimary
      : variant === 'ghost'
      ? colors.primaryInk
      : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        size === 'lg' ? styles.large : styles.medium,
        styles[variant],
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      {Icon && (
        <Icon color={tint} size={size === 'lg' ? 21 : 18} strokeWidth={2} />
      )}
      <AppText
        variant="subheading"
        color={tint}
        style={[
          size === 'md' && styles.mediumLabel,
          !!TrailingIcon && styles.grow,
        ]}
      >
        {label}
      </AppText>
      {TrailingIcon && <TrailingIcon color={tint} size={21} strokeWidth={2} />}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
  },
  large: { minHeight: 56, paddingVertical: 15 },
  medium: { minHeight: 44, paddingVertical: 11, borderRadius: radius.md },
  primary: { backgroundColor: colors.primary },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ghost: { backgroundColor: 'transparent' },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.83, transform: [{ scale: 0.985 }] },
  mediumLabel: { fontSize: 14, lineHeight: 20 },
  grow: { flex: 1 },
});
