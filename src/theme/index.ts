import type { TextStyle } from 'react-native';

// 기존 달료 브랜드: 민트·하늘색·초원. 레이아웃을 개선해도 대표 색감은 유지한다.
export const colors = {
  sceneSky: '#CBEBF6',
  track: '#DDF4EC',
  trackLine: '#FFFFFF',
  primary: '#22B48F',
  primaryPressed: '#1A9475',
  primarySoft: '#DDF4EC',
  primaryInk: '#10775E',
  primaryBorder: '#B5E6D6',
  primaryStrong: '#10775E',
  background: '#EAF7FA',
  sky: '#CBEBF6',
  surface: '#FFFFFF',
  surfaceMuted: '#F1F6F6',
  border: '#DCEBEA',
  grassBack: '#B9E08C',
  grassFront: '#92CF63',
  grassShade: '#7BBE4D',
  grassDeep: '#8AC95B',
  flower: '#FFFFFF',
  flowerCenter: '#FFD45C',
  cloud: '#FFFFFF',
  gold: '#FFC83D',
  goldInk: '#8A5A00',
  heart: '#FF6B8A',
  text: '#16211E',
  textMuted: '#5F6E6A',
  textSubtle: '#9AAAA6',
  textOnPrimary: '#FFFFFF',
  accent: '#F5A524',
  accentSoft: '#FFF4E1',
  accentInk: '#9A5B00',
  danger: '#E0524D',
  overlay: 'rgba(17,20,18,0.78)',
  stoneTint: '#8E9290',
  stoneSoft: '#ECEDEC',
} as const;

// Pretendard (SIL OFL). Android는 파일명, iOS는 PostScript 이름으로 찾는데 둘이 같다.
// 커스텀 폰트에는 fontWeight를 함께 주지 않는다 (Android에서 시스템 폰트로 바뀔 수 있음)
export const fonts = {
  regular: 'Pretendard-Regular',
  medium: 'Pretendard-Medium',
  semibold: 'Pretendard-SemiBold',
  bold: 'Pretendard-Bold',
  extrabold: 'Pretendard-ExtraBold',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

type TypographyVariant =
  | 'display'
  | 'title'
  | 'heading'
  | 'subheading'
  | 'body'
  | 'bodyRegular'
  | 'caption'
  | 'label'
  | 'number';

export const typography: Record<TypographyVariant, TextStyle> = {
  display: {
    fontFamily: fonts.extrabold,
    fontSize: 56,
    lineHeight: 64,
    letterSpacing: -1.5,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 28,
    lineHeight: 36,
    letterSpacing: -0.8,
  },
  heading: {
    fontFamily: fonts.bold,
    fontSize: 20,
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  subheading: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  body: {
    fontFamily: fonts.medium,
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: -0.1,
  },
  bodyRegular: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.1,
  },
  number: {
    fontFamily: fonts.bold,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
};

export const shadow = {
  card: {
    shadowColor: '#101814',
    shadowOpacity: 0.025,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 0,
  },
  button: {
    shadowColor: '#0E7A50',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  floating: {
    shadowColor: '#101814',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
} as const;
