import React from 'react';
import {Text, type TextProps} from 'react-native';
import {colors, typography} from '../../theme';

type Variant = keyof typeof typography;

type Props = TextProps & {
  variant?: Variant;
  color?: string;
  align?: 'left' | 'center' | 'right';
};

// 앱의 모든 글자는 이 컴포넌트로 쓴다 (Pretendard + 단계별 굵기)
export function AppText({variant = 'body', color = colors.text, align, style, ...rest}: Props) {
  return <Text {...rest} style={[typography[variant], {color}, align && {textAlign: align}, style]} />;
}
