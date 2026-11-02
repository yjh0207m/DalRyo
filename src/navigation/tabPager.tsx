import React, {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  useWindowDimensions,
  View,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from 'react-native';
import type { MainTab } from './BottomTabBar';
import { animateTo, DURATION } from './motion';
import {
  isHorizontalDrag,
  isTabSwipe,
  SWIPE_TAB_ORDER,
  tabIndex,
} from './tabSwipe';

// 탭들을 가로로 한 줄에 놓인 것처럼 다룬다. position은 '지금 화면 가운데에 오는 탭의 번호'(소수 가능)이고,
// 각 탭은 (자기 번호 - position) × 화면 너비만큼 옆으로 밀려 있다.
// 손가락을 따라 position이 바뀌고, 놓으면 가까운 정수로 자리를 잡는다. 탭 바를 눌러도 같은 방식으로 움직인다.
// position이 절대 번호라서 전환이 끝나도 값을 되돌릴 필요가 없고, 끝나는 순간 화면이 튀지 않는다.

const RESISTANCE = 0.25;
const LAST = SWIPE_TAB_ORDER.length - 1;

export type TabPager = ReturnType<typeof useTabPager>;

export function useTabPager({
  active,
  enabled,
  onChange,
}: {
  active: MainTab;
  enabled: boolean;
  onChange: (tab: MainTab) => void;
}) {
  const { width } = useWindowDimensions();
  const position = useRef(
    new Animated.Value(Math.max(0, tabIndex(active))),
  ).current;
  // 전환하는 동안 활성 탭 옆에 같이 그려 두는 탭
  const [extra, setExtra] = useState<MainTab[]>([]);
  const latest = useRef({ active, enabled, onChange, width });
  latest.current = { active, enabled, onChange, width };
  const busy = useRef(false);

  // 탭 바를 누르거나 알림처럼 바깥에서 탭이 바뀌었을 때, 움직이는 중이 아니면 애니메이션 없이 위치만 맞춘다
  useLayoutEffect(() => {
    if (!busy.current && tabIndex(active) >= 0)
      position.setValue(tabIndex(active));
  }, [active, position]);

  // target 탭으로 자리를 잡는다. 이미 활성 탭이면 원래 자리로 되돌아온다
  const settleTo = useCallback(
    (target: MainTab) => {
      const { active: current, onChange: change } = latest.current;
      const to = tabIndex(target);
      if (to < 0 || tabIndex(current) < 0) {
        if (target !== current) change(target);
        return;
      }
      busy.current = true;
      const stay = target === current;
      setExtra(stay ? [] : [target]);
      // 지금 위치에서 얼마나 남았는지에 따라 시간을 줄여, 거의 다 온 상태에서 놓았을 때 늘어지지 않게 한다
      position.stopAnimation(value => {
        const remaining = Math.min(1, Math.abs(to - value));
        animateTo(position, to, {
          duration: Math.round(
            (stay ? DURATION.cancel : DURATION.settle) *
              Math.max(0.4, remaining),
          ),
          onEnd: () => {
            busy.current = false;
            if (!stay) change(target);
            setExtra([]);
          },
        });
      });
    },
    [position],
  );

  const goTo = useCallback(
    (tab: MainTab) => {
      if (tab === latest.current.active) return;
      settleTo(tab);
    },
    [settleTo],
  );

  const responder = useMemo(
    () =>
      PanResponder.create({
        // 누르는 동작은 가져가지 않는다. 움직임이 가로로 확실할 때만 가져간다
        onMoveShouldSetPanResponder: (
          _event: GestureResponderEvent,
          gesture: PanResponderGestureState,
        ) => latest.current.enabled && isHorizontalDrag(gesture),
        onPanResponderGrant: () => {
          busy.current = true;
          position.stopAnimation();
        },
        onPanResponderMove: (
          _event: GestureResponderEvent,
          gesture: PanResponderGestureState,
        ) => {
          const { active: current, width: w } = latest.current;
          const base = tabIndex(current);
          const raw = base - gesture.dx / w;
          // 한 번에 옆 탭까지만 갈 수 있다. 맨 끝 탭 너머로 끌면 저항을 줘서 더 갈 곳이 없다는 느낌을 준다
          const near = Math.min(base + 1, Math.max(base - 1, raw));
          const shown =
            near < 0
              ? near * RESISTANCE
              : near > LAST
              ? LAST + (near - LAST) * RESISTANCE
              : near;
          const neighbor = SWIPE_TAB_ORDER[raw < base ? base - 1 : base + 1];
          // 끌기 시작하면 옆 탭을 그려 둔다. 방향이 바뀔 때만 상태를 바꿔 매번 다시 그리지 않는다
          setExtra(previous =>
            neighbor
              ? previous[0] === neighbor
                ? previous
                : [neighbor]
              : previous.length
              ? []
              : previous,
          );
          position.setValue(shown);
        },
        onPanResponderRelease: (
          _event: GestureResponderEvent,
          gesture: PanResponderGestureState,
        ) => {
          const { active: current, width: w, enabled: on } = latest.current;
          const next =
            SWIPE_TAB_ORDER[tabIndex(current) + (gesture.dx < 0 ? 1 : -1)];
          busy.current = false;
          if (on && next && isTabSwipe(gesture, w)) settleTo(next);
          else settleTo(current);
        },
        onPanResponderTerminate: () => {
          busy.current = false;
          settleTo(latest.current.active);
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [position, settleTo],
  );

  // 탭 번호별로 '옆으로 밀린 거리'를 만든다. 너비가 바뀔 때만 다시 만든다
  const offsets = useMemo(
    () =>
      SWIPE_TAB_ORDER.map(tab =>
        Animated.multiply(
          Animated.subtract(new Animated.Value(tabIndex(tab)), position),
          width,
        ),
      ),
    [position, width],
  );

  return {
    active,
    extra,
    position,
    width,
    goTo,
    panHandlers: responder.panHandlers,
    offset: (tab: MainTab) => offsets[tabIndex(tab)],
  };
}

// 활성 탭과 전환 중인 옆 탭을 겹쳐 그린다. 전환 중이 아니면 활성 탭 하나만 아무 변형 없이 그린다
export function TabPagerView({
  pager,
  renderTab,
}: {
  pager: TabPager;
  renderTab: (tab: MainTab) => ReactNode;
}) {
  const tabs = [
    pager.active,
    ...pager.extra.filter(tab => tab !== pager.active),
  ];
  const moving = pager.extra.length > 0;
  return (
    <View style={styles.body} {...pager.panHandlers}>
      {tabs.map(tab => (
        <Animated.View
          key={tab}
          style={[
            StyleSheet.absoluteFill,
            moving && { transform: [{ translateX: pager.offset(tab) }] },
          ]}
        >
          {renderTab(tab)}
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, overflow: 'hidden' },
});
