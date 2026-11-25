import React from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { colors, radius, spacing, themedStyles } from '../../theme';
import { AppText } from './AppText';
type Props = {
  label: string;
  onPress: () => void;
  // danger: 되돌릴 수 없는 일(회원 탈퇴 등). 빨간 테두리와 글자
  // soft: 옅은 색 바탕에 진한 색 글자. 기능 바로가기처럼 눈에 띄되 주 버튼보다는 가벼운 자리에 쓴다
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft';
  // soft의 색. primary는 브랜드 파랑, accent는 골드(랭킹·성취)
  tone?: 'primary' | 'accent';
  size?: 'lg' | 'md';
  icon?: LucideIcon;
  trailingIcon?: LucideIcon;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  // 화면 읽기 프로그램이 읽을 이름. 없으면 버튼 글자(label)를 읽는다
  accessibilityLabel?: string;
};
export function Button({
  label,
  onPress,
  variant = 'primary',
  tone = 'primary',
  size = 'lg',
  icon: Icon,
  trailingIcon: TrailingIcon,
  disabled,
  style,
  accessibilityLabel,
}: Props) {
  const tint =
    variant === 'primary'
      ? colors.textOnPrimary
      : variant === 'ghost'
      ? colors.primaryInk
      : variant === 'danger'
      ? colors.danger
      : variant === 'soft'
      ? tone === 'accent'
        ? colors.accentInk
        : colors.primaryInk
      : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        size === 'lg' ? styles.large : styles.medium,
        variant === 'soft'
          ? tone === 'accent'
            ? styles.softAccent
            : styles.soft
          : styles[variant],
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
const styles = themedStyles(() => ({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
  },
  large: { minHeight: 56, paddingVertical: 15 },
  medium: { minHeight: 44, paddingVertical: 11, borderRadius: radius.md },
  primary: { backgroundColor: colors.primaryAction },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ghost: { backgroundColor: 'transparent' },
  danger: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  // 글자 대비: 라이트 4.98:1(파랑·골드), 다크 5.6:1(파랑)·8.2:1(골드)
  soft: { backgroundColor: colors.primarySoft },
  softAccent: { backgroundColor: colors.accentSoft },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.83, transform: [{ scale: 0.985 }] },
  mediumLabel: { fontSize: 14, lineHeight: 20 },
  grow: { flex: 1 },
}));
