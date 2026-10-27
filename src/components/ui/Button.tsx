import React from 'react';
import {Pressable, StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native';
import type {LucideIcon} from 'lucide-react-native';
import {colors, radius, spacing} from '../../theme';
import {AppText} from './AppText';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'lg' | 'md';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

const HEIGHT: Record<Size, number> = {lg: 58, md: 48};
// 게임식 입체 버튼: 아래쪽 두꺼운 "턱"이 있고, 누르면 턱만큼 눌려 내려간다
const LIP = 5;

export function Button({label, onPress, variant = 'primary', size = 'lg', icon: Icon, disabled, style}: Props) {
  const tint = variant === 'primary' ? colors.textOnPrimary : variant === 'secondary' ? colors.text : colors.primaryInk;
  const solid = variant !== 'ghost';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{disabled}}
      disabled={disabled}
      onPress={onPress}
      style={[{height: HEIGHT[size] + (solid ? LIP : 0)}, disabled && styles.disabled, style]}>
      {({pressed}) => (
        <>
          {solid && <View style={[styles.lip, {top: LIP, height: HEIGHT[size]}, variant === 'primary' ? styles.lipPrimary : styles.lipSecondary]} />}
          <View
            style={[
              styles.face,
              {height: HEIGHT[size]},
              variant === 'primary' && styles.primary,
              variant === 'secondary' && styles.secondary,
              solid && pressed && {transform: [{translateY: LIP - 1}]},
              !solid && pressed && styles.ghostPressed,
            ]}>
            {Icon && <Icon color={tint} size={size === 'lg' ? 22 : 18} strokeWidth={2.4} />}
            <AppText variant={size === 'lg' ? 'subheading' : 'body'} color={tint} style={size === 'lg' && styles.labelLg}>
              {label}
            </AppText>
          </View>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  face: {
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  lip: {position: 'absolute', left: 0, right: 0, borderRadius: radius.lg},
  lipPrimary: {backgroundColor: colors.primaryPressed},
  lipSecondary: {backgroundColor: colors.border},
  primary: {backgroundColor: colors.primary},
  secondary: {backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border},
  ghostPressed: {backgroundColor: colors.surfaceMuted},
  disabled: {opacity: 0.4},
  labelLg: {fontSize: 17},
});
