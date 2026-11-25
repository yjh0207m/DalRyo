import React from 'react';
import {
  Pressable,
  type AccessibilityRole,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, fonts, radius, spacing, themedStyles } from '../../theme';
import { AppText } from './AppText';

// 여러 개 중에서 고르는 칩(지역·공개 범위·말투·목표 거리 등). 어느 화면에서나 "고른 것"이 같은 모양으로 보인다.
// 고른 칩: 연한 민트 바탕 + 민트 테두리 + 민트 글자. 고르지 않은 칩: 테두리만
export function Chip({
  label,
  selected,
  onPress,
  disabled = false,
  role = 'radio',
  accessibilityLabel,
  size = 'md',
  grow = false,
  style,
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  // 하나만 고르면 radio, 여러 개를 켜고 끄면 checkbox, 누르면 바로 정해지면 button
  role?: Extract<AccessibilityRole, 'radio' | 'checkbox' | 'button'>;
  accessibilityLabel?: string;
  // lg: 목표 거리처럼 칩 하나가 큰 값일 때
  size?: 'md' | 'lg';
  // 한 줄에 같은 폭으로 나눠 갖는다
  grow?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole={role}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={
        role === 'checkbox'
          ? { checked: selected, disabled }
          : { selected, disabled }
      }
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        size === 'lg' && styles.large,
        grow && styles.grow,
        selected && styles.selected,
        pressed && !selected && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <AppText
        variant={size === 'lg' ? 'subheading' : 'caption'}
        color={selected ? colors.primaryInk : colors.text}
        style={selected ? styles.selectedText : styles.text}
        numberOfLines={1}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = themedStyles(() => ({
  chip: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  large: { minHeight: 52, borderRadius: radius.md },
  grow: { flex: 1 },
  selected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  pressed: { backgroundColor: colors.surfaceMuted },
  disabled: { opacity: 0.45 },
  text: { fontFamily: fonts.medium },
  selectedText: { fontFamily: fonts.bold },
}));
