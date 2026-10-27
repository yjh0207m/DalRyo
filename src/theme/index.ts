import type {TextStyle} from 'react-native';

// 디자인 토큰. 리디자인 시 이 파일의 값만 바꾸면 토큰을 쓰는 화면에 일괄 반영된다.
// 새 화면은 색·간격·모서리·글자를 하드코딩하지 말고 여기서 가져다 쓴다.
//
// 무드: "맑은 하늘 아래 초원을 달리는 캐릭터" (Figma 시안의 하늘색·민트·초원 분위기를 다듬은 것)
//
// 원칙
// - 배경은 옅은 하늘색, 브랜드 색(민트)은 "누를 수 있는 것·진행 상태"에만 쓴다
// - 초원(grass)은 장면 일러스트에만 쓰고 UI 요소에는 쓰지 않는다
// - 따뜻한 색(amber)은 경고·일시정지 같은 감정 신호에만 쓴다
// - 그림자는 최소, 경계는 얇은 선으로 나눈다
// - 글자 굵기는 단계별로만 쓴다 (모든 글자를 굵게 하지 않는다)

export const colors = {
  // 시안의 민트(#6DD5BE)는 흰 글자 대비가 낮아 한 톤 깊게 잡았다
  primary: '#22B48F',
  primaryPressed: '#1A9475',
  primarySoft: '#DDF4EC',
  primaryInk: '#10775E',
  primaryBorder: '#B5E6D6',
  // 기존 화면 호환용 별칭
  primaryStrong: '#10775E',

  background: '#EAF7FA',
  // 장면(월드)의 하늘. 흰 구름이 보이도록 배경보다 한 톤 진하다
  sky: '#CBEBF6',
  surface: '#FFFFFF',
  surfaceMuted: '#F1F6F6',
  border: '#DCEBEA',

  // 초원 장면 전용
  grassBack: '#B9E08C',
  grassFront: '#92CF63',
  grassShade: '#7BBE4D',
  // 초원 맨 아래 색 (grassFront 위에 grassShade 35%를 겹친 값). 초원 아래를 이어 칠할 때 쓴다
  grassDeep: '#8AC95B',
  flower: '#FFFFFF',
  flowerCenter: '#FFD45C',
  cloud: '#FFFFFF',

  // 게임 요소 (레벨 배지·하트·연속 기록)
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
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

type TypographyVariant = 'display' | 'title' | 'heading' | 'subheading' | 'body' | 'bodyRegular' | 'caption' | 'label' | 'number';

export const typography: Record<TypographyVariant, TextStyle> = {
  display: {fontFamily: fonts.extrabold, fontSize: 56, lineHeight: 64, letterSpacing: -1.5},
  title: {fontFamily: fonts.bold, fontSize: 26, lineHeight: 34, letterSpacing: -0.6},
  heading: {fontFamily: fonts.bold, fontSize: 19, lineHeight: 26, letterSpacing: -0.3},
  subheading: {fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22, letterSpacing: -0.2},
  body: {fontFamily: fonts.medium, fontSize: 15, lineHeight: 22, letterSpacing: -0.1},
  bodyRegular: {fontFamily: fonts.regular, fontSize: 15, lineHeight: 22},
  caption: {fontFamily: fonts.medium, fontSize: 13, lineHeight: 18},
  label: {fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 0.1},
  number: {fontFamily: fonts.bold, fontSize: 24, lineHeight: 30, letterSpacing: -0.5, fontVariant: ['tabular-nums']},
};

export const shadow = {
  card: {
    shadowColor: '#101814',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 4},
    elevation: 1,
  },
  button: {
    shadowColor: '#0E7A50',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: {width: 0, height: 4},
    elevation: 3,
  },
  floating: {
    shadowColor: '#101814',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: {width: 0, height: 6},
    elevation: 6,
  },
} as const;
