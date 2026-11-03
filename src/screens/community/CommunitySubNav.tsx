import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from 'react-native';
import {
  Compass,
  MessageSquare,
  Menu,
  Newspaper,
  UserRound,
  type LucideIcon,
} from 'lucide-react-native';
import { AppText } from '../../components/ui';
import { animateTo } from '../../navigation/motion';
import { colors, radius, shadow } from '../../theme';

// 커뮤니티 화면 아래, 기존 하단 탭 바 위에 얹는 작은 서브 네비게이션.
// 평소에는 가운데에 동그란 메뉴 버튼 하나만 있고, 누르는 즉시 양옆으로 피드·탐색·메시지·프로필이 펼쳐진다.
// 누른 채 원하는 메뉴 위로 끌어서 놓으면 그 메뉴로 이동하고, 메뉴가 아닌 곳에서 놓으면 아무 일 없이 접힌다.
// 끌지 않고 톡 눌렀다 떼면 펼쳐진 채로 남아 눌러서 고를 수 있다(화면 읽기 기능도 같은 방식).

export type SubNavKey = 'feed' | 'explore' | 'messages' | 'profile';

export const SUB_NAV_ITEMS: Array<{
  key: SubNavKey;
  label: string;
  icon: LucideIcon;
}> = [
  { key: 'feed', label: '피드', icon: Newspaper },
  { key: 'explore', label: '탐색', icon: Compass },
  { key: 'messages', label: '메시지', icon: MessageSquare },
  { key: 'profile', label: '내 프로필', icon: UserRound },
];

// 배치: [피드][탐색] (●) [메시지][프로필]. 모두 고정 크기라서 화면 가운데에 놓이면 각 칸의 위치를 계산으로 알 수 있다
export const ITEM_WIDTH = 56;
export const CENTER_SIZE = 44;
export const GAP = 8;
const PADDING = 8;
export const ROW_HEIGHT = 56;
export const ROW_WIDTH = PADDING * 2 + ITEM_WIDTH * 4 + CENTER_SIZE + GAP * 4;
// 이 시간 안에 떼면 끌지 않은 '톡 누르기'로 본다(ms)
export const TAP_MS = 300;
// 누른 채 끌 때 손가락이 메뉴 줄 위아래로 이만큼 벗어나도 그 메뉴를 고른 것으로 본다
const VERTICAL_SLACK = 60;
const TAP_SLOP = 12;

// 가운데 버튼 옆 n번째(0이 가장 가까움) 메뉴가 접혀 있을 때의 위치까지 가운데 쪽으로 옮겨야 하는 거리
const travelFrom = (nearest: number) =>
  nearest * (ITEM_WIDTH + GAP) + (ITEM_WIDTH + CENTER_SIZE) / 2 + GAP;

type Geometry = { width: number; height: number; bottom: number };

// 메뉴 줄의 칸별 가로 범위(화면 좌표). 가운데 칸은 메뉴가 아니다
export function slotRanges(width: number) {
  let x = (width - ROW_WIDTH) / 2 + PADDING;
  const slots: Array<{ key: SubNavKey | null; left: number; right: number }> =
    [];
  const order: Array<SubNavKey | null> = [
    'feed',
    'explore',
    null,
    'messages',
    'profile',
  ];
  for (const key of order) {
    const size = key === null ? CENTER_SIZE : ITEM_WIDTH;
    slots.push({ key, left: x, right: x + size });
    x += size + GAP;
  }
  return slots;
}

// 화면 좌표 (pageX, pageY)의 손가락이 어느 메뉴 위에 있는지. 없으면 null
export function subNavItemAt(pageX: number, pageY: number, geometry: Geometry) {
  const top = geometry.height - geometry.bottom - ROW_HEIGHT;
  if (pageY < top - VERTICAL_SLACK || pageY > top + ROW_HEIGHT + VERTICAL_SLACK)
    return null;
  const slot = slotRanges(geometry.width).find(
    item => pageX >= item.left - GAP / 2 && pageX <= item.right + GAP / 2,
  );
  return slot?.key ?? null;
}

export function CommunitySubNav({
  bottom,
  unreadMessages,
  current,
  onSelect,
  progress,
}: {
  // 화면 아래에서 띄우는 거리. 기존 하단 탭 바의 바로 위가 되도록 부모가 계산해 준다
  bottom: number;
  unreadMessages?: boolean;
  // 지금 보고 있는 메뉴. 펼쳤을 때 표시해 준다
  current?: SubNavKey;
  onSelect: (key: SubNavKey) => void;
  // 펼침 정도(0 접힘 ~ 1 펼침). 부모가 넘겨 주면 같은 값으로 글쓰기 버튼 같은 요소도 움직여서
  // 상태가 바뀔 때까지 기다리지 않고 메뉴와 똑같은 순간에 같이 움직인다
  progress?: Animated.Value;
}) {
  const { width, height } = useWindowDimensions();
  const [mode, setMode] = useState<'closed' | 'hold' | 'open'>('closed');
  const [hover, setHover] = useState<SubNavKey | null>(null);
  const ownGrow = useRef(new Animated.Value(0)).current;
  const grow = progress ?? ownGrow;
  const modeRef = useRef(mode);
  const hoverRef = useRef<SubNavKey | null>(null);
  const press = useRef({ at: 0, wasOpen: false, moved: false });
  const latest = useRef({ width, height, bottom, onSelect, grow });
  latest.current = { width, height, bottom, onSelect, grow };

  const show = (next: 'closed' | 'hold' | 'open') => {
    modeRef.current = next;
    setMode(next);
    // 제스처 처리기는 한 번만 만들어지므로, 그때그때 최신 값을 읽는다
    animateTo(latest.current.grow, next === 'closed' ? 0 : 1, {
      duration: 180,
    });
  };
  const hoverOver = (key: SubNavKey | null) => {
    if (hoverRef.current === key) return;
    hoverRef.current = key;
    setHover(key);
  };
  const choose = (key: SubNavKey) => {
    show('closed');
    hoverOver(null);
    latest.current.onSelect(key);
  };
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        // 누른 채 끄는 동안 탭 스와이프 같은 다른 제스처가 가져가지 못하게 한다
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          press.current = {
            at: Date.now(),
            wasOpen: modeRef.current === 'open',
            moved: false,
          };
          show('hold');
        },
        onPanResponderMove: (
          _event: GestureResponderEvent,
          gesture: PanResponderGestureState,
        ) => {
          if (
            Math.abs(gesture.dx) > TAP_SLOP ||
            Math.abs(gesture.dy) > TAP_SLOP
          )
            press.current.moved = true;
          const { width: w, height: h, bottom: b } = latest.current;
          hoverOver(
            subNavItemAt(gesture.moveX, gesture.moveY, {
              width: w,
              height: h,
              bottom: b,
            }),
          );
        },
        onPanResponderRelease: () => {
          const picked = hoverRef.current;
          const { at, wasOpen, moved } = press.current;
          hoverOver(null);
          if (picked) {
            show('closed');
            latest.current.onSelect(picked);
          } else if (!wasOpen && !moved && Date.now() - at < TAP_MS)
            // 끌지 않고 톡 눌렀다 뗐다: 펼쳐 둬서 눌러서 고를 수 있게 한다
            show('open');
          else show('closed');
        },
        onPanResponderTerminate: () => {
          show('closed');
          hoverOver(null);
        },
      }),
    // show·hoverOver는 ref와 상태 변경만 쓰므로 한 번만 만든다
    [],
  );

  const expanded = mode !== 'closed';
  // 화면에서 사라지면 접힌 상태로 돌려 놓는다(함께 움직이던 요소가 올라간 채 남지 않게)
  useEffect(() => () => grow.setValue(0), [grow]);
  const idle = useMemo(
    () => grow.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
    [grow],
  );
  const pillScale = useMemo(
    () => grow.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }),
    [grow],
  );
  const renderItem = (item: (typeof SUB_NAV_ITEMS)[number], travel: number) => (
    <Item
      key={item.key}
      item={item}
      grow={grow}
      open={expanded}
      // 가운데에서 바깥으로 펼쳐지도록, 접힌 위치는 가운데 쪽이다
      travel={travel}
      hovered={hover === item.key}
      current={current === item.key}
      dot={item.key === 'messages' && !!unreadMessages}
      onPress={() => choose(item.key)}
    />
  );
  // 항목과 배경은 접혀 있어도 지우지 않고 투명하게 둔다.
  // 지우면 닫히는 모습이 보이지 않고, 값에 연결된 뷰가 하나도 남지 않은 화면(글쓰기 버튼이 없는 메시지)에서는
  // 애니메이션 값이 멈춰 버려(AnimatedValue.__detach) 다음에 열 때도 끊긴다
  return (
    <View pointerEvents="box-none" style={styles.root}>
      {mode === 'open' && (
        <Pressable
          accessibilityLabel="메뉴 닫기"
          accessibilityRole="button"
          onPress={() => show('closed')}
          style={StyleSheet.absoluteFill}
        />
      )}
      <View pointerEvents="box-none" style={[styles.dock, { bottom }]}>
        <View style={styles.row} pointerEvents="box-none">
          <Animated.View
            pointerEvents="none"
            style={[
              styles.pill,
              { opacity: grow, transform: [{ scaleX: pillScale }] },
            ]}
          />
          {SUB_NAV_ITEMS.slice(0, 2).map((item, index) =>
            renderItem(item, travelFrom(1 - index)),
          )}
          <View
            {...responder.panHandlers}
            accessible
            accessibilityRole="button"
            accessibilityLabel="커뮤니티 메뉴"
            accessibilityHint="길게 누른 채 원하는 메뉴로 끌어 놓으면 이동해요"
            accessibilityState={{ expanded }}
            accessibilityActions={SUB_NAV_ITEMS.map(item => ({
              name: item.key,
              label: item.label,
            }))}
            onAccessibilityAction={event =>
              choose(event.nativeEvent.actionName as SubNavKey)
            }
            style={styles.center}
          >
            {/* 색도 함께 서서히 바뀌도록, 접힌 모습과 펼친 모습을 겹쳐 두고 번갈아 드러낸다 */}
            <Animated.View
              pointerEvents="none"
              style={[styles.centerActive, { opacity: grow }]}
            />
            <Animated.View pointerEvents="none" style={{ opacity: idle }}>
              <Menu color={colors.primaryInk} size={22} strokeWidth={2.2} />
            </Animated.View>
            <Animated.View
              pointerEvents="none"
              style={[styles.centerIconActive, { opacity: grow }]}
            >
              <Menu color={colors.textOnPrimary} size={22} strokeWidth={2.2} />
            </Animated.View>
            {unreadMessages && (
              <Animated.View
                pointerEvents="none"
                style={[styles.dot, { opacity: idle }]}
              />
            )}
          </View>
          {SUB_NAV_ITEMS.slice(2).map((item, index) =>
            renderItem(item, -travelFrom(index)),
          )}
        </View>
      </View>
    </View>
  );
}

function Item({
  item,
  grow,
  open,
  travel,
  hovered,
  current,
  dot,
  onPress,
}: {
  item: (typeof SUB_NAV_ITEMS)[number];
  grow: Animated.Value;
  // 펼쳐져 있는지. 접혀 있으면 보이지 않으니 누를 수도, 읽을 수도 없다
  open: boolean;
  travel: number;
  hovered: boolean;
  current: boolean;
  dot: boolean;
  onPress: () => void;
}) {
  const Icon = item.icon;
  const translateX = useMemo(
    () => grow.interpolate({ inputRange: [0, 1], outputRange: [travel, 0] }),
    [grow, travel],
  );
  const scale = useMemo(
    () =>
      grow.interpolate({
        inputRange: [0, 1],
        outputRange: [0.6, hovered ? 1.12 : 1],
      }),
    [grow, hovered],
  );
  return (
    <Animated.View
      pointerEvents={open ? 'auto' : 'none'}
      accessibilityElementsHidden={!open}
      importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
      style={{ opacity: grow, transform: [{ translateX }, { scale }] }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={open ? item.label : undefined}
        accessibilityState={{ selected: hovered }}
        onPress={onPress}
        style={[
          styles.item,
          current && styles.itemCurrent,
          hovered && styles.itemHovered,
        ]}
      >
        <Icon
          color={hovered ? colors.textOnPrimary : colors.primaryInk}
          size={22}
          strokeWidth={2}
        />
        <AppText
          variant="label"
          color={hovered ? colors.textOnPrimary : colors.textMuted}
          style={styles.itemLabel}
        >
          {item.label}
        </AppText>
        {dot && <View style={styles.dot} />}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill },
  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: GAP,
    height: ROW_HEIGHT,
    paddingHorizontal: PADDING,
  },
  pill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: ROW_HEIGHT / 2,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadow.floating,
  },
  center: {
    width: CENTER_SIZE,
    height: CENTER_SIZE,
    borderRadius: CENTER_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadow.floating,
  },
  centerActive: {
    ...StyleSheet.absoluteFill,
    borderRadius: CENTER_SIZE / 2,
    backgroundColor: colors.primary,
  },
  centerIconActive: { position: 'absolute' },
  item: {
    width: ITEM_WIDTH,
    height: ROW_HEIGHT - 8,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  itemCurrent: { backgroundColor: colors.primarySoft },
  itemHovered: { backgroundColor: colors.primary },
  itemLabel: { fontSize: 10, lineHeight: 12 },
  dot: {
    position: 'absolute',
    top: 6,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
  },
});
