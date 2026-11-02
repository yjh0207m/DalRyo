import React, { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { Animated, StyleSheet, useWindowDimensions } from 'react-native';
import { colors } from '../theme';
import { dispatchBack } from './backGesture';
import { animateTo, DURATION } from './motion';
import { registerSlide } from './slideRegistry';

// 다른 화면 위에 오른쪽에서 밀려 들어오는 화면. 뒤로 갈 때는 오른쪽으로 밀려 나가고, iOS에서는 왼쪽 가장자리를
// 잡고 끌면 손가락을 따라 움직인다(backGesture.tsx의 EdgeBackSwipe).
// children에는 닫는 함수(back)가 넘어온다. 화면의 뒤로가기 버튼과 Android 뒤로가기가 이 함수를 부르면
// 밀려 나간 다음에 onBack이 실행된다. 확인 창이 필요한 화면은 확인을 받은 뒤 back을 부르면 된다.
export function SlideScreen({
  onBack,
  animateIn = true,
  children,
}: {
  // 밀려 나간 뒤에 실제로 화면을 없애는 함수
  onBack: () => void;
  // false면 처음부터 제자리에 있다(앱이 이미 이 화면을 열어 둔 채 시작할 때)
  animateIn?: boolean;
  children: (back: () => void) => ReactNode;
}) {
  const { width } = useWindowDimensions();
  const x = useRef(new Animated.Value(animateIn ? width : 0)).current;
  const closing = useRef(false);
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  const widthRef = useRef(width);
  widthRef.current = width;

  useEffect(() => {
    if (animateIn) animateTo(x, 0, { duration: DURATION.enter });
    // 처음 한 번만 들어온다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const back = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    animateTo(x, widthRef.current, {
      duration: DURATION.exit,
      onEnd: () => onBackRef.current(),
    });
  }, [x]);

  useEffect(
    () =>
      registerSlide({
        drag: dx => {
          if (!closing.current)
            x.setValue(Math.min(widthRef.current, Math.max(0, dx)));
        },
        release: commit => {
          if (closing.current) return;
          if (commit) {
            // 화면이 등록한 뒤로가기(확인 창이 있으면 그 확인을 거친다)에 맡기고, 닫히지 않으면 제자리로 돌려놓는다
            dispatchBack();
            if (closing.current) return;
          }
          animateTo(x, 0, { duration: DURATION.cancel });
        },
      }),
    [x],
  );

  return (
    <Animated.View style={[styles.screen, { transform: [{ translateX: x }] }]}>
      {children(back)}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.background,
    // 아래 화면 위에 떠 있다는 느낌을 주는 왼쪽 그림자(iOS)
    shadowColor: '#0A1E1A',
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: -4, height: 0 },
  },
});
