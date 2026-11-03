import React from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  useWindowDimensions,
} from 'react-native';
import Renderer, { act } from 'react-test-renderer';
import {
  CommunitySubNav,
  TAP_MS,
  ROW_HEIGHT,
  slotRanges,
  subNavItemAt,
  type SubNavKey,
} from '../src/screens/community/CommunitySubNav';

jest.mock(
  'lucide-react-native',
  () => new Proxy({}, { get: () => () => null }),
);

const BOTTOM = 100;
let tree: Renderer.ReactTestRenderer;
let responder: Record<string, (...args: any[]) => any>;
let screen = { width: 0, height: 0 };
const onSelect = jest.fn();

function Probe() {
  screen = useWindowDimensions();
  return null;
}
const center = (key: SubNavKey) => {
  const slot = slotRanges(screen.width).find(item => item.key === key)!;
  return (slot.left + slot.right) / 2;
};
const rowY = () => screen.height - BOTTOM - ROW_HEIGHT / 2;
const has = (label: string) =>
  tree.root.findAll(node => node.props?.accessibilityLabel === label).length >
  0;
const menu = () =>
  tree.root.find(node => node.props?.accessibilityLabel === '커뮤니티 메뉴');
const grant = () => act(async () => responder.onPanResponderGrant());
const holdLongEnough = () =>
  act(async () => {
    jest.advanceTimersByTime(TAP_MS + 10);
  });
const moveTo = (moveX: number, moveY: number) =>
  act(async () =>
    responder.onPanResponderMove({}, { moveX, moveY, dx: 0, dy: 0 }),
  );
const release = () => act(async () => responder.onPanResponderRelease());

beforeEach(async () => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  const create = PanResponder.create.bind(PanResponder);
  jest.spyOn(PanResponder, 'create').mockImplementation(config => {
    responder = config as typeof responder;
    return create(config);
  });
  await act(async () => {
    tree = Renderer.create(
      <>
        <Probe />
        <CommunitySubNav bottom={BOTTOM} onSelect={onSelect} />
      </>,
    );
  });
});
afterEach(async () => {
  await act(async () => tree.unmount());
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('where a finger is', () => {
  const geometry = () => ({ ...screen, bottom: BOTTOM });

  test('each of the four menus is found at its own place, and the middle button is not a menu', () => {
    for (const key of ['feed', 'explore', 'messages', 'profile'] as const)
      expect(subNavItemAt(center(key), rowY(), geometry())).toBe(key);
    expect(subNavItemAt(screen.width / 2, rowY(), geometry())).toBeNull();
  });

  test('the left two are on the left of the middle button, the right two on the right', () => {
    expect(center('feed')).toBeLessThan(center('explore'));
    expect(center('explore')).toBeLessThan(screen.width / 2);
    expect(center('messages')).toBeGreaterThan(screen.width / 2);
    expect(center('messages')).toBeLessThan(center('profile'));
  });

  test('a finger a bit above or below the row still counts, but far away does not', () => {
    expect(subNavItemAt(center('feed'), rowY() - 40, geometry())).toBe('feed');
    expect(subNavItemAt(center('feed'), rowY() + 40, geometry())).toBe('feed');
    expect(subNavItemAt(center('feed'), rowY() - 400, geometry())).toBeNull();
  });

  test('off to the sides of the row is nothing', () => {
    expect(subNavItemAt(2, rowY(), geometry())).toBeNull();
    expect(subNavItemAt(screen.width - 2, rowY(), geometry())).toBeNull();
  });
});

describe('the menu button', () => {
  test('at rest only the round button shows', () => {
    expect(has('커뮤니티 메뉴')).toBe(true);
    for (const label of ['피드', '탐색', '메시지', '내 프로필'])
      expect(has(label)).toBe(false);
  });

  test('pressing spreads the four menus out to both sides right away', async () => {
    await grant();
    for (const label of ['피드', '탐색', '메시지', '내 프로필'])
      expect(has(label)).toBe(true);
    expect(menu().props.accessibilityState).toEqual({ expanded: true });
  });

  test('dragging onto a menu and letting go goes there and folds back', async () => {
    await grant();
    await holdLongEnough();
    await moveTo(center('messages'), rowY());
    await release();
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('messages');
    expect(has('메시지')).toBe(false);
  });

  test('moving across several menus only selects the one under the finger at the end', async () => {
    await grant();
    await holdLongEnough();
    await moveTo(center('feed'), rowY());
    await moveTo(center('explore'), rowY());
    await moveTo(center('profile'), rowY());
    await release();
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('profile');
  });

  test('letting go away from the menus just folds it back without going anywhere', async () => {
    await grant();
    await holdLongEnough();
    await moveTo(center('feed'), rowY());
    await moveTo(center('feed'), rowY() - 500);
    await release();
    expect(onSelect).not.toHaveBeenCalled();
    expect(has('피드')).toBe(false);
  });

  test('letting go on the middle button itself selects nothing', async () => {
    await grant();
    await holdLongEnough();
    await moveTo(screen.width / 2, rowY());
    await release();
    expect(onSelect).not.toHaveBeenCalled();
  });

  test('a drag that ends away from the menus folds back instead of staying open', async () => {
    await grant();
    await act(async () =>
      responder.onPanResponderMove({}, { moveX: 0, moveY: 0, dx: 40, dy: 0 }),
    );
    await release();
    expect(has('피드')).toBe(false);
    expect(onSelect).not.toHaveBeenCalled();
  });

  test('holding without a drag and letting go away from the menus also folds back', async () => {
    await grant();
    await holdLongEnough();
    await release();
    expect(has('피드')).toBe(false);
    expect(onSelect).not.toHaveBeenCalled();
  });

  test('being interrupted closes it without selecting', async () => {
    await grant();
    await holdLongEnough();
    await moveTo(center('explore'), rowY());
    await act(async () => responder.onPanResponderTerminate());
    expect(onSelect).not.toHaveBeenCalled();
    expect(has('탐색')).toBe(false);
  });

  test('other gestures such as a tab swipe cannot take the touch away once it is held', () => {
    expect(responder.onStartShouldSetPanResponder()).toBe(true);
    expect(responder.onPanResponderTerminationRequest()).toBe(false);
  });

  test('a quick tap without dragging leaves it open so a menu can be tapped, and tapping again closes it', async () => {
    await grant();
    await release();
    expect(has('탐색')).toBe(true);
    await act(async () => {
      tree.root
        .find(
          node =>
            node.props?.accessibilityLabel === '탐색' &&
            typeof node.props.onPress === 'function',
        )
        .props.onPress();
    });
    expect(onSelect).toHaveBeenCalledWith('explore');
    expect(has('탐색')).toBe(false);

    await grant();
    await release();
    expect(has('탐색')).toBe(true);
    await grant();
    await release();
    expect(has('탐색')).toBe(false);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  test('a screen reader can pick a menu directly', async () => {
    await act(async () => {
      menu().props.onAccessibilityAction({
        nativeEvent: { actionName: 'explore' },
      });
    });
    expect(onSelect).toHaveBeenCalledWith('explore');
    expect(menu().props.accessibilityActions.map((a: any) => a.label)).toEqual([
      '피드',
      '탐색',
      '메시지',
      '내 프로필',
    ]);
  });
});

describe('unread messages', () => {
  // 점은 접혀 있어도 지우지 않고 투명도로 드러낸다
  const dotOpacities = () =>
    tree.root
      .findAll(
        node =>
          typeof node.type === 'string' &&
          StyleSheet.flatten(node.props.style)?.width === 8,
      )
      .map(node => {
        // 메뉴 항목의 점은 항목 전체의 투명도를 따른다
        let opacity = StyleSheet.flatten(node.props.style)?.opacity;
        for (let up = node.parent; opacity === undefined && up; up = up.parent)
          if (typeof up.type === 'string')
            opacity = StyleSheet.flatten(up.props.style)?.opacity;
        return opacity;
      });

  test('a dot shows on the middle button while folded and on the message menu when spread', async () => {
    await act(async () => {
      tree.update(
        <>
          <Probe />
          <CommunitySubNav bottom={BOTTOM} unreadMessages onSelect={onSelect} />
        </>,
      );
    });
    // [메뉴 버튼, 메시지 메뉴] 순서
    expect(dotOpacities()).toEqual([1, 0]);
    await grant();
    expect(dotOpacities()).toEqual([0, 1]);
  });

  test('no dots at all without unread messages', async () => {
    expect(dotOpacities()).toEqual([]);
  });
});

describe('moving smoothly in both directions', () => {
  const items = ['피드', '탐색', '메시지', '내 프로필'];
  // 항목은 접혀도 그대로 남아 있어야 닫히는 모습이 보인다
  const mounted = () =>
    tree.root
      .findAllByType(Text)
      .map(node => node.props.children)
      .filter(text => items.includes(text));

  test('the menus stay on screen while folding, invisible and untouchable once folded', async () => {
    expect(mounted()).toEqual(items);
    await grant();
    await holdLongEnough();
    expect(mounted()).toEqual(items);
    await release();
    expect(mounted()).toEqual(items);
    const wrapper = tree.root.findAll(
      node =>
        typeof node.type === 'string' &&
        node.props.pointerEvents === 'none' &&
        node.props.accessibilityElementsHidden === true,
    );
    expect(wrapper).toHaveLength(4);
  });

  test('its animated value keeps something attached, so React Native never stops it midway', async () => {
    const progress = new Animated.Value(0) as unknown as Animated.Value & {
      __getChildren: () => unknown[];
    };
    await act(async () => {
      tree.update(
        <>
          <Probe />
          <CommunitySubNav
            bottom={BOTTOM}
            progress={progress}
            onSelect={onSelect}
          />
        </>,
      );
    });
    const attached = () => progress.__getChildren().length;
    expect(attached()).toBeGreaterThan(0);
    await grant();
    await holdLongEnough();
    await release();
    expect(attached()).toBeGreaterThan(0);
    await grant();
    expect(attached()).toBeGreaterThan(0);
  });
});

describe('sharing its movement with other elements', () => {
  const value = (animated: Animated.Value) =>
    (animated as unknown as { __getValue: () => number }).__getValue();

  test('drives the value it is given the moment it opens, and back to 0 when it closes', async () => {
    const progress = new Animated.Value(0);
    await act(async () => {
      tree.update(
        <>
          <Probe />
          <CommunitySubNav
            bottom={BOTTOM}
            progress={progress}
            onSelect={onSelect}
          />
        </>,
      );
    });
    expect(value(progress)).toBe(0);
    await grant();
    expect(value(progress)).toBe(1);
    // 끌어서 메뉴가 아닌 곳에서 놓으면 접힌다
    await act(async () =>
      responder.onPanResponderMove({}, { moveX: 0, moveY: 0, dx: 40, dy: 0 }),
    );
    await release();
    expect(value(progress)).toBe(0);
  });

  test('puts the value back to 0 if it disappears while open, so nothing stays moved aside', async () => {
    const progress = new Animated.Value(0);
    await act(async () => {
      tree.update(
        <>
          <Probe />
          <CommunitySubNav
            bottom={BOTTOM}
            progress={progress}
            onSelect={onSelect}
          />
        </>,
      );
    });
    await grant();
    expect(value(progress)).toBe(1);
    await act(async () => {
      tree.update(<Probe />);
    });
    expect(value(progress)).toBe(0);
  });
});
