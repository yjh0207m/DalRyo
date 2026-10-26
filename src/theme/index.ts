// 디자인 토큰. 리디자인 시 이 파일의 값만 바꾸면 토큰을 쓰는 화면에 일괄 반영된다.
// 새 화면은 색·간격·모서리·글자 크기를 하드코딩하지 말고 여기서 가져다 쓴다.

export const colors = {
  primary: '#58CFA6',
  primaryStrong: '#2BAF85',
  primarySoft: '#EFFFF8',
  primaryBorder: '#C8F1E0',

  background: '#F6FEFF',
  surface: '#FFFFFF',
  border: '#E4ECE9',

  text: '#151515',
  textMuted: '#808080',
  textSubtle: '#B0B0B0',
  textOnPrimary: '#FFFFFF',

  danger: '#C95B5B',
  overlay: 'rgba(21,21,21,0.72)',
  stoneTint: '#9A9A9A',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 20,
  xl: 24,
  pill: 999,
} as const;

export const typography = {
  display: {fontSize: 56, fontWeight: '900' as const, letterSpacing: -1},
  title: {fontSize: 28, fontWeight: '900' as const, lineHeight: 38},
  heading: {fontSize: 20, fontWeight: '900' as const},
  body: {fontSize: 16, fontWeight: '700' as const},
  caption: {fontSize: 13, fontWeight: '800' as const},
} as const;

export const shadow = {
  card: {
    shadowColor: '#A7D7C4',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: {width: 0, height: 8},
    elevation: 6,
  },
  button: {
    shadowColor: '#58CFA6',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: {width: 0, height: 8},
    elevation: 6,
  },
} as const;
