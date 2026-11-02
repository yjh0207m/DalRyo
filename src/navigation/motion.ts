import { Animated, Easing } from 'react-native';

// 화면 전환 애니메이션의 공통 설정. 테스트에서는 jest.setup.js가 꺼서 애니메이션 없이 바로 끝낸다
export const motion = { enabled: true };

// 화면이 한 번에 움직이는 시간(ms). 길이가 길수록 부드럽지만 느리게 느껴진다
export const DURATION = { enter: 280, exit: 220, settle: 240, cancel: 200 };

// value를 toValue까지 움직인다. 끝까지 움직인 경우에만 onEnd를 부른다.
// 다른 애니메이션이나 직접 값 지정으로 끊기면 호출하지 않는다
export function animateTo(
  value: Animated.Value,
  toValue: number,
  options: { duration?: number; onEnd?: () => void } = {},
) {
  const { duration = DURATION.settle, onEnd } = options;
  if (!motion.enabled || duration <= 0) {
    value.setValue(toValue);
    onEnd?.();
    return;
  }
  Animated.timing(value, {
    toValue,
    duration,
    easing: Easing.out(Easing.cubic),
    useNativeDriver: true,
  }).start(({ finished }) => {
    if (finished) onEnd?.();
  });
}
