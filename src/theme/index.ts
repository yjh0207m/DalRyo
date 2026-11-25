import { useSyncExternalStore } from 'react';
import { Appearance, StyleSheet, type TextStyle } from 'react-native';

// 달료 색 컨셉: 블루 원톤(2026-11-25).
// 색 비율은 중성색 70 · 보조색 25 · 주조색 5. 주조색(파랑)은 "지금 누를 것"(달리기·주요 버튼·현재 탭·선택한 칩·진행 막대)과
// 화면마다 핵심 숫자 하나에만 쓴다. 보조색(하늘)은 요약 띠·차트·달린 날 표시·정보 아이콘에 쓴다.
// 성공·경고·오류는 브랜드 색과 따로 둔다. 초원·하늘 장면 그림의 색은 캐릭터 세계라 그대로 둔다
const lightColors = {
  sceneSky: '#CBEBF6',
  track: '#DDF4EC',
  trackLine: '#FFFFFF',
  // 주조색. 흰 바탕 대비 5.7:1, 흰 글자 대비 5.7:1
  primary: '#0A66C2',
  primaryAction: '#0A66C2',
  primaryPressed: '#0857A6',
  // 선택한 칩·내 말풍선·안 읽은 알림·서브 메뉴 버튼 같은 "고른 상태"의 옅은 면
  primarySoft: '#E8F1FB',
  primaryInk: '#0A66C2',
  primaryBorder: '#A9CBF0',
  primaryStrong: '#0A66C2',
  // 보조색. 요약 띠(기록 탭 이번 달, 같이 달리기 머리 영역, 공유한 기록)·차트·달린 날 표시
  secondary: '#2F6FAE',
  secondarySoft: '#EAF2FB',
  // 진행 막대(경험치·목표)의 아직 채우지 않은 부분. 반투명이라 회색 띠·하늘 띠 어디에 놓여도 옅게 보이고,
  // 채운 부분(주조색)과 확실히 구분된다
  progressTrack: 'rgba(10,102,194,0.14)',
  // 모든 화면의 바탕. 탭 화면과 하위 화면이 같은 흰색이다
  background: '#FFFFFF',
  sky: '#CBEBF6',
  surface: '#FFFFFF',
  // 화면 위에 떠 있는 것(아래에서 올라오는 시트·메뉴, 떠 있는 서브 메뉴, 작은 팝업). 밝은 테마는 흰 바탕과 같다
  surfaceRaised: '#FFFFFF',
  // 푸른 기운의 쿨 그레이
  surfaceMuted: '#F2F4F7',
  border: '#E1E5EA',
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
  text: '#141A21',
  textMuted: '#5A6573',
  textSubtle: '#66717F',
  textOnPrimary: '#FFFFFF',
  accent: '#F5A524',
  accentSoft: '#FFF4E1',
  accentInk: '#9A5B00',
  // 시맨틱: 성공(브랜드 파랑과 따로)·오류
  success: '#1E7F4A',
  danger: '#C93B3B',
  overlay: 'rgba(16,20,26,0.78)',
  // 시트·메뉴 뒤를 어둡게 가리는 막
  scrim: 'rgba(15,23,34,0.45)',
  stoneTint: '#8E9290',
  stoneSoft: '#ECEDEC',
};

export type ThemeColors = { [K in keyof typeof lightColors]: string };

// 다크 모드.
// - 바탕은 모든 화면에서 같은 한 가지 색이다. 파랑과 어울리는 푸른 기운의 어두운 쿨 그레이(#131920).
//   화면 바탕(background)과 기본 면(surface)을 같게 두고, 그 위에 떠 있는 시트·메뉴만 surfaceRaised로 살짝 띄운다.
//   회색 단계(띄운 면·옅은 면·선)는 모두 같은 푸른 기운을 가져 서로 어울린다.
// - 주조색 파랑은 밝은 테마와 같은 선명한 파랑(#1F6FEB)에 흰 글자를 쓴다(4.6:1, 바탕 대비 3.8:1).
//   예전처럼 옅은 하늘색에 어두운 글자를 쓰면 버튼이 탁하고 어둡게 보였다.
//   파랑 글자(링크·핵심 숫자)만 읽히도록 밝은 파랑(primaryInk #7DB7FF, 8.5:1)을 쓴다.
// - 초원·하늘 장면은 밤 풍경처럼 채도를 낮춘다
const darkColors: ThemeColors = {
  sceneSky: '#1D3442',
  track: '#22403A',
  trackLine: '#3C5E55',
  primary: '#1F6FEB',
  primaryAction: '#1F6FEB',
  primaryPressed: '#1859C7',
  // 고른 상태의 면. 남색이 아니라 파랑으로 보이게 채도를 올렸다(바탕 대비 1.5:1)
  primarySoft: '#173866',
  // 바탕 위 파랑 글자(8.5:1)
  primaryInk: '#7DB7FF',
  primaryBorder: '#2D64B8',
  primaryStrong: '#7DB7FF',
  secondary: '#8CC2FF',
  progressTrack: 'rgba(255,255,255,0.08)',
  // 요약 띠. 바탕보다 확실히 밝은 파랑(1.7:1)이고, 그 위 보조 글자도 4.5:1로 읽힌다
  secondarySoft: '#163E77',
  background: '#131920',
  sky: '#1D3442',
  surface: '#131920',
  surfaceRaised: '#1C232D',
  surfaceMuted: '#252E39',
  border: '#323C48',
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
  text: '#F0F3F6',
  // 바탕 대비 7.8:1, 6.0:1
  textMuted: '#A2ADBA',
  textSubtle: '#8C97A5',
  textOnPrimary: '#FFFFFF',
  accent: '#F5A524',
  accentSoft: '#3A2D14',
  accentInk: '#F5C26B',
  success: '#3FCF8E',
  danger: '#FF7B72',
  overlay: 'rgba(0,0,0,0.82)',
  // 어두운 바탕에서는 색 기운 없이 어둡게만
  scrim: 'rgba(0,0,0,0.6)',
  stoneTint: '#8E9290',
  stoneSoft: '#2A2D31',
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
  // 알림창·날짜 선택 같은 시스템 창과 키보드도 앱에서 고른 밝기를 따르게 한다.
  // 안드로이드는 이때 values-night의 강조색(밝은 파랑)으로 바뀐다
  try {
    Appearance.setColorScheme?.(next);
  } catch {
    // 지원하지 않는 환경에서는 기기 설정을 따른다
  }
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

// 화면 전체가 주조색(primary)일 때의 상태 표시줄 글자색. 두 테마 모두 주조색 위 글자가 흰색이다
export function statusBarOnPrimary(): 'light-content' | 'dark-content' {
  return colors.textOnPrimary === '#FFFFFF' ? 'light-content' : 'dark-content';
}

// 켜고 끄는 스위치의 색. 켜지면 동그라미가 주조색, 길이 연한 주조색이다.
// 안드로이드는 따로 정하지 않으면 시스템 기본 강조색(초록)으로 그린다
export function switchColors(on: boolean) {
  return {
    trackColor: { false: colors.border, true: colors.primaryBorder },
    thumbColor: on ? colors.primary : colors.surfaceRaised,
    ios_backgroundColor: colors.border,
  };
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
  | 'number'
  | 'numberHero'
  | 'numberLarge';

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
  // 숫자는 세 단계만 쓴다.
  // number: 줄 안의 기록 값(시간·페이스·칼로리)
  number: {
    fontFamily: fonts.bold,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  // numberLarge: 카드·목록 한 칸의 대표 숫자(기록 목록의 거리, 오늘의 러닝, 첨부한 기록)
  numberLarge: {
    fontFamily: fonts.extrabold,
    fontSize: 36,
    lineHeight: 44,
    letterSpacing: -1.2,
    fontVariant: ['tabular-nums'],
  },
  // numberHero: 화면 하나의 주인공 숫자(피드의 공유한 기록).
  // 성장·기록 탭의 누적 거리와 기록 상세의 거리는 세로로 늘린 TallNumber를 쓴다(아래 summaryNumber)
  numberHero: {
    fontFamily: fonts.extrabold,
    fontSize: 56,
    lineHeight: 66,
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
  },
};

// 요약 띠의 거리 숫자. 기록 탭 "이번 달 누적 거리"와 러닝 저널 기록 상세가 똑같은 높이·모양으로 보이도록
// 여기 한 곳에서 정하고 TallNumber에 넘긴다. stretch는 세로로 늘리는 배율(성장 탭 기본 1.07보다 조금 더)
export const summaryNumber = {
  fontSize: 50,
  lineHeight: 62,
  stretch: 1.11,
  style: {
    fontFamily: fonts.extrabold,
    letterSpacing: -1.8,
    fontVariant: ['tabular-nums'],
  } as TextStyle,
};

export const shadow = {
  card: {
    shadowColor: '#0F1722',
    shadowOpacity: 0.025,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 0,
  },
  button: {
    shadowColor: '#0A3A73',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  floating: {
    shadowColor: '#0F1722',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
} as const;
