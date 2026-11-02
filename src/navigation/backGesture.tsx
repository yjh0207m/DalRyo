import React, { useMemo, useRef } from 'react';
import {
  BackHandler,
  PanResponder,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from 'react-native';
import { topSlide, type SlideEntry } from './slideRegistry';

// iOS는 화면 왼쪽 가장자리를 오른쪽으로 쓸어 넘기면 뒤로 가는 것이 기본 동작이다.
// 이 앱은 화면마다 Android 뒤로가기(BackHandler 'hardwareBackPress')에 뒤로 가는 동작을 등록해 두는데,
// iOS의 BackHandler는 아무 일도 하지 않는 빈 껍데기라 등록만 되고 실행되지 않는다.
// 그래서 iOS에서만 등록을 가로채 보관했다가, 가장자리 스와이프가 Android와 같은 순서
// (나중에 등록한 화면부터, true를 돌려주는 화면에서 멈춤)로 호출하게 한다. 화면 코드는 바꾸지 않는다.

type BackHandlerFn = () => boolean | null | undefined;

const handlers: BackHandlerFn[] = [];
let installed = false;
let original: typeof BackHandler.addEventListener | null = null;

export function installIosBackBridge() {
  if (Platform.OS !== 'ios' || installed) return;
  installed = true;
  const delegate = BackHandler.addEventListener.bind(BackHandler);
  original = BackHandler.addEventListener;
  BackHandler.addEventListener = ((
    eventName: Parameters<typeof BackHandler.addEventListener>[0],
    handler: BackHandlerFn,
  ) => {
    if (eventName !== 'hardwareBackPress') return delegate(eventName, handler);
    handlers.push(handler);
    return {
      remove: () => {
        const index = handlers.lastIndexOf(handler);
        if (index >= 0) handlers.splice(index, 1);
      },
    };
  }) as typeof BackHandler.addEventListener;
}

// 등록된 뒤로가기 중 어느 화면이 처리했으면 true. 처리할 화면이 없으면 false(최상위 화면)
export function dispatchBack(): boolean {
  for (let index = handlers.length - 1; index >= 0; index -= 1) {
    if (handlers[index]()) return true;
  }
  return false;
}

// 테스트에서 가로채기를 걷어내고 상태를 비울 때 쓴다
export function resetBackBridge() {
  if (original) BackHandler.addEventListener = original;
  original = null;
  installed = false;
  handlers.length = 0;
}

// 가장자리에서 시작해 이만큼 이상 오른쪽으로, 위아래보다 더 가로로 움직이면 뒤로 가기로 본다
export const EDGE_WIDTH = 16;
export const BACK_MIN_DX = 60;
// 화면을 끌고 있을 때는 화면 너비의 이만큼 이상 끌었거나 빠르게 튕겼으면 뒤로 간다
const BACK_FRACTION = 0.3;
const BACK_FLICK_VX = 0.4;

type Gesture = Pick<PanResponderGestureState, 'dx' | 'dy'> &
  Partial<Pick<PanResponderGestureState, 'vx'>>;

// 끌 화면이 없을 때(밀려 들어온 화면이 없는 곳)는 이 기준으로 바로 뒤로 간다
export function isBackSwipe(gesture: Gesture) {
  return gesture.dx >= BACK_MIN_DX && gesture.dx > Math.abs(gesture.dy) * 1.5;
}

// 화면을 손가락에 따라 끌다가 놓았을 때 뒤로 갈지
export function shouldGoBack(gesture: Gesture, width: number) {
  if (gesture.dx <= Math.abs(gesture.dy) * 1.5) return false;
  if (gesture.dx >= width * BACK_FRACTION) return true;
  return (gesture.vx ?? 0) >= BACK_FLICK_VX && gesture.dx >= 30;
}

// 화면 왼쪽 가장자리의 얇은 띠. iOS에서만 그린다. 이 띠에서 시작한 손가락만 받으므로 나머지 화면의 터치는 그대로다.
// 맨 위에 밀려 들어온 화면(SlideScreen)이 있으면 그 화면이 손가락을 따라 움직이고, 없으면 놓았을 때 바로 뒤로 간다
export function EdgeBackSwipe() {
  const { width } = useWindowDimensions();
  const widthRef = useRef(width);
  widthRef.current = width;
  const dragged = useRef<SlideEntry | null>(null);
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          dragged.current = topSlide();
        },
        onPanResponderMove: (
          _event: GestureResponderEvent,
          gesture: PanResponderGestureState,
        ) => {
          dragged.current?.drag(gesture.dx);
        },
        onPanResponderRelease: (
          _event: GestureResponderEvent,
          gesture: PanResponderGestureState,
        ) => {
          const slide = dragged.current;
          dragged.current = null;
          if (slide) slide.release(shouldGoBack(gesture, widthRef.current));
          else if (isBackSwipe(gesture)) dispatchBack();
        },
        onPanResponderTerminate: () => {
          const slide = dragged.current;
          dragged.current = null;
          slide?.release(false);
        },
      }),
    [],
  );
  if (Platform.OS !== 'ios') return null;
  return <View style={styles.edge} {...responder.panHandlers} />;
}

const styles = StyleSheet.create({
  edge: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: EDGE_WIDTH,
  },
});
