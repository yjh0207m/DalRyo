import { useSyncExternalStore } from 'react';
import { StyleSheet, type TextStyle } from 'react-native';

// 기존 달료 브랜드: 민트·하늘색·초원. 레이아웃을 개선해도 대표 색감은 유지한다.
const lightColors = {
  sceneSky: '#CBEBF6',
  track: '#DDF4EC',
  trackLine: '#FFFFFF',
  primary: '#22B48F',
  primaryAction: '#147D64',
  primaryPressed: '#1A9475',
  primarySoft: '#DDF4EC',
  primaryInk: '#10775E',
  primaryBorder: '#B5E6D6',
  primaryStrong: '#10775E',
  background: '#F5F7F6',
  sky: '#CBEBF6',
  surface: '#FFFFFF',
  // 화면 위에 떠 있는 것(아래에서 올라오는 시트·메뉴, 떠 있는 서브 메뉴, 작은 팝업). 밝은 테마는 흰 바탕과 같다
  surfaceRaised: '#FFFFFF',
  surfaceMuted: '#EDF2F0',
  border: '#E0E7E4',
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
  textSubtle: '#64756E',
  textOnPrimary: '#FFFFFF',
  accent: '#F5A524',
  accentSoft: '#FFF4E1',
  accentInk: '#9A5B00',
  danger: '#E0524D',
  overlay: 'rgba(17,20,18,0.78)',
  // 시트·메뉴 뒤를 어둡게 가리는 막
  scrim: 'rgba(10,30,26,0.45)',
  stoneTint: '#8E9290',
  stoneSoft: '#ECEDEC',
};

export type ThemeColors = { [K in keyof typeof lightColors]: string };

// 다크 모드.
// - 바탕은 모든 화면에서 검은색(#000) 하나다. 화면 바탕(background)과 기본 면(surface)을 같게 두고,
//   그 위에 떠 있는 시트·메뉴만 surfaceRaised(#1C1C1E)로 살짝 띄운다. 회색은 녹색 기운 없는 중립 회색이다.
// - 대표 민트는 같은 색상(약 163°)에서 밝기만 올려 검은 바탕 위에서도 선명하게 보이게 한다(바탕 대비 11:1).
//   밝은 민트 위에는 흰 글자가 묻히므로(1.9:1) 아주 어두운 녹색 글자를 쓴다(9.9:1).
// - 초원·하늘 장면은 밤 풍경처럼 채도를 낮춘다
const darkColors: ThemeColors = {
  sceneSky: '#1D3442',
  track: '#22403A',
  trackLine: '#3C5E55',
  primary: '#2ED3A5',
  primaryAction: '#2ED3A5',
  primaryPressed: '#25B58D',
  // 강조 띠·선택한 칩·내 말풍선. 검은 바탕 위에서 민트 기운만 살짝 남긴다
  primarySoft: '#11302A',
  // 검은 바탕 위 민트 글자(12.8:1)
  primaryInk: '#5CE0BB',
  primaryBorder: '#1F5A49',
  primaryStrong: '#5CE0BB',
  background: '#000000',
  sky: '#1D3442',
  surface: '#000000',
  surfaceRaised: '#1C1C1E',
  surfaceMuted: '#262629',
  border: '#333336',
  grassBack: '#3F6B37',
  grassFront: '#4E8240',
  grassShade: '#5E9A4A',
  grassDeep: '#477A3B',
  flower: '#D9E4DF',
  // 홈 장면의 해가 밤에는 옅은 노란 달처럼 보이게 한다
  flowerCenter: '#EFD98C',
  cloud: '#33454F',
  gold: '#FFC83D',
  goldInk: '#F2C75C',
  heart: '#FF6B8A',
  text: '#F5F5F7',
  // 검은 바탕 대비 8.2:1, 6.4:1
  textMuted: '#A1A1A6',
  textSubtle: '#8E8E93',
  textOnPrimary: '#03140E',
  accent: '#F5A524',
  accentSoft: '#3A2D14',
  accentInk: '#F5C26B',
  danger: '#F27571',
  overlay: 'rgba(0,0,0,0.82)',
  // 검은 바탕에서는 녹색 기운 없이 어둡게만
  scrim: 'rgba(0,0,0,0.6)',
  stoneTint: '#8E9290',
  stoneSoft: '#2A2A2D',
};

// 지금 테마의 색. 테마가 바뀌면 이 객체의 값을 그 자리에서 바꾼다(객체는 그대로).
// 화면에서 렌더링할 때 읽는 colors.x는 바로 새 값이 되고, 모듈을 불러올 때 고정되는 스타일은 themedStyles로 만든다
export const colors: ThemeColors = { ...lightColors };

export type ThemeMode = 'light' | 'dark';
let mode: ThemeMode = 'light';
// 테마가 바뀔 때마다 1씩 늘어난다. themedStyles가 이 값으로 다시 계산할지 정한다
let version = 0;
const listeners = new Set<() => void>();

export function getThemeMode(): ThemeMode {
  return mode;
}

export function setThemeMode(next: ThemeMode) {
  if (next === mode) return;
  mode = next;
  Object.assign(colors, next === 'dark' ? darkColors : lightColors);
  version += 1;
  listeners.forEach(listener => listener());
}

export function subscribeThemeMode(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// 앱 맨 위(App)에서 구독한다. 테마가 바뀌면 App부터 다시 그려져 아래 화면이 모두 새 색으로 그려진다
export function useThemeMode() {
  return useSyncExternalStore(subscribeThemeMode, getThemeMode, getThemeMode);
}

// 상태 표시줄 글자색. 어두운 바탕에서는 밝은 글자
export function statusBarStyle(): 'light-content' | 'dark-content' {
  return mode === 'dark' ? 'light-content' : 'dark-content';
}

// 화면 전체가 민트(primary)일 때의 상태 표시줄 글자색. 밝은 테마는 흰 글자, 다크 모드는 밝은 민트라 어두운 글자
export function statusBarOnPrimary(): 'light-content' | 'dark-content' {
  return mode === 'dark' ? 'dark-content' : 'light-content';
}

// StyleSheet.create 대신 쓴다. make 안에서 읽는 colors 값이 테마를 따라가도록, 테마가 바뀐 뒤 처음 읽을 때 다시 만든다.
// 화면 코드는 그대로 styles.xxx로 쓴다
export function themedStyles<
  T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>,
>(make: () => T & StyleSheet.NamedStyles<any>): T {
  let cached: T | null = null;
  let builtFor = -1;
  const current = (): T => {
    if (!cached || builtFor !== version) {
      cached = StyleSheet.create(make());
      builtFor = version;
    }
    return cached;
  };
  return new Proxy({} as T, {
    get: (_target, key) => (current() as Record<PropertyKey, unknown>)[key],
    has: (_target, key) => key in current(),
    ownKeys: () => Reflect.ownKeys(current()),
    getOwnPropertyDescriptor: (_target, key) => {
      const descriptor = Reflect.getOwnPropertyDescriptor(current(), key);
      return descriptor && { ...descriptor, configurable: true };
    },
  });
}

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
  // 화면 안에서 기능 묶음(구역)과 구역 사이의 세로 간격. 모든 탭 화면이 같은 값을 쓴다
  section: 32,
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
    fontSize: 15,
    lineHeight: 21,
    letterSpacing: -0.2,
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
