import type { PanResponderGestureState } from 'react-native';
import type { MainTab } from './BottomTabBar';

// 하단 탭의 왼쪽→오른쪽 순서. 중앙의 달리기 버튼은 탭이 아니라 팝업을 여는 버튼이라 넣지 않는다
export const SWIPE_TAB_ORDER: MainTab[] = [
  'home',
  'growth',
  'community',
  'records',
];

export function tabIndex(tab: MainTab) {
  return SWIPE_TAB_ORDER.indexOf(tab);
}

// 손가락을 오른쪽에서 왼쪽으로 쓸면 다음(오른쪽) 탭, 왼쪽에서 오른쪽으로 쓸면 이전(왼쪽) 탭. 양 끝에서는 더 가지 않는다
export function adjacentTab(active: MainTab, direction: 'next' | 'previous') {
  const index = tabIndex(active);
  if (index < 0) return null;
  return SWIPE_TAB_ORDER[index + (direction === 'next' ? 1 : -1)] ?? null;
}

// 스크롤 같은 세로 움직임과 헷갈리지 않도록 가로가 세로의 2배 넘게 큰 움직임만 가로 스와이프로 본다
const START_DX = 16;
const DOMINANCE = 2;
// 화면 너비의 이만큼 이상 끌었거나, 짧아도 빠르게 튕겼으면 다음 탭으로 넘어간다
const COMMIT_FRACTION = 0.2;
const FLICK_VX = 0.3;
const FLICK_MIN_DX = 30;

type Gesture = Pick<PanResponderGestureState, 'dx' | 'dy'> &
  Partial<Pick<PanResponderGestureState, 'vx'>>;

export function isHorizontalDrag(gesture: Gesture) {
  return (
    Math.abs(gesture.dx) >= START_DX &&
    Math.abs(gesture.dx) > Math.abs(gesture.dy) * DOMINANCE
  );
}

// 손가락을 뗐을 때 탭을 넘길지 정한다
export function isTabSwipe(gesture: Gesture, width: number) {
  const distance = Math.abs(gesture.dx);
  if (distance <= Math.abs(gesture.dy) * DOMINANCE) return false;
  if (distance >= width * COMMIT_FRACTION) return true;
  // 속도는 가려는 방향과 같을 때만 센다
  const flick = (gesture.vx ?? 0) * Math.sign(gesture.dx);
  return flick >= FLICK_VX && distance >= FLICK_MIN_DX;
}
