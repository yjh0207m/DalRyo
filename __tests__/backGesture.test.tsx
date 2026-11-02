import React from 'react';
import { BackHandler, PanResponder, Platform, StyleSheet } from 'react-native';
import Renderer, { act } from 'react-test-renderer';
import * as bridge from '../src/navigation/backGesture';
import { registerSlide, resetSlides } from '../src/navigation/slideRegistry';

const setOS = (os: string) => {
  (Platform as { OS: string }).OS = os;
};
const originalOS = Platform.OS;
const originalAdd = BackHandler.addEventListener;
afterEach(() => {
  setOS(originalOS);
  bridge.resetBackBridge();
  BackHandler.addEventListener = originalAdd;
  jest.restoreAllMocks();
});

describe('the iOS back bridge', () => {
  test('does nothing on Android, where the system already sends the back press', () => {
    setOS('android');
    bridge.installIosBackBridge();
    expect(BackHandler.addEventListener).toBe(originalAdd);
  });

  test('keeps the back handlers screens register and runs the newest first', () => {
    bridge.installIosBackBridge();
    const calls: string[] = [];
    BackHandler.addEventListener('hardwareBackPress', () => {
      calls.push('older');
      return true;
    });
    BackHandler.addEventListener('hardwareBackPress', () => {
      calls.push('newer');
      return true;
    });
    expect(bridge.dispatchBack()).toBe(true);
    expect(calls).toEqual(['newer']);
  });

  test('falls through to an older screen when the newest one does not handle the back press', () => {
    bridge.installIosBackBridge();
    const calls: string[] = [];
    BackHandler.addEventListener('hardwareBackPress', () => {
      calls.push('older');
      return true;
    });
    BackHandler.addEventListener('hardwareBackPress', () => {
      calls.push('newer');
      return false;
    });
    expect(bridge.dispatchBack()).toBe(true);
    expect(calls).toEqual(['newer', 'older']);
  });

  test('a screen that goes away is no longer called', () => {
    bridge.installIosBackBridge();
    const gone = jest.fn(() => true);
    const stays = jest.fn(() => true);
    BackHandler.addEventListener('hardwareBackPress', stays);
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      gone,
    );
    subscription.remove();
    subscription.remove();
    bridge.dispatchBack();
    expect(gone).not.toHaveBeenCalled();
    expect(stays).toHaveBeenCalledTimes(1);
  });

  test('with no screen to go back from (top level) it reports that nothing handled it', () => {
    bridge.installIosBackBridge();
    expect(bridge.dispatchBack()).toBe(false);
    BackHandler.addEventListener('hardwareBackPress', () => false);
    expect(bridge.dispatchBack()).toBe(false);
  });

  test('other events are passed to the original BackHandler untouched', () => {
    const original = jest.fn(() => ({ remove: jest.fn() }));
    BackHandler.addEventListener =
      original as unknown as typeof BackHandler.addEventListener;
    bridge.installIosBackBridge();
    const handler = jest.fn();
    (
      BackHandler.addEventListener as unknown as (
        name: string,
        fn: () => void,
      ) => unknown
    )('somethingElse', handler);
    expect(original).toHaveBeenCalledWith('somethingElse', handler);
  });

  test('installing twice does not wrap it twice', () => {
    bridge.installIosBackBridge();
    const once = BackHandler.addEventListener;
    bridge.installIosBackBridge();
    expect(BackHandler.addEventListener).toBe(once);
  });
});

describe('the left edge swipe', () => {
  type Config = {
    onStartShouldSetPanResponder: () => boolean;
    onPanResponderGrant: () => void;
    onPanResponderMove: (
      event: unknown,
      gesture: { dx: number; dy: number },
    ) => void;
    onPanResponderRelease: (
      event: unknown,
      gesture: { dx: number; dy: number; vx?: number },
    ) => void;
    onPanResponderTerminate: () => void;
  };
  let config: Config;
  let tree: Renderer.ReactTestRenderer;
  beforeEach(() => {
    jest.spyOn(PanResponder, 'create').mockImplementation(((given: unknown) => {
      config = given as Config;
      return { panHandlers: {} };
    }) as unknown as typeof PanResponder.create);
  });
  afterEach(async () => {
    resetSlides();
    await act(async () => tree?.unmount());
  });
  async function render() {
    await act(async () => {
      tree = Renderer.create(<bridge.EdgeBackSwipe />);
    });
  }

  test('is a thin strip along the left edge on iOS, so the rest of the screen keeps its touches', async () => {
    await render();
    const strip = tree.toJSON() as { props: { style: object } } | null;
    expect(strip).not.toBeNull();
    expect(StyleSheet.flatten(strip!.props.style)).toMatchObject({
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: bridge.EDGE_WIDTH,
    });
    expect(bridge.EDGE_WIDTH).toBeLessThanOrEqual(24);
    expect(config.onStartShouldSetPanResponder()).toBe(true);
  });

  test('does not exist on Android', async () => {
    setOS('android');
    await render();
    expect(tree.toJSON()).toBeNull();
  });

  test('a clear swipe to the right goes back through the registered screens', async () => {
    bridge.installIosBackBridge();
    const back = jest.fn(() => true);
    BackHandler.addEventListener('hardwareBackPress', back);
    await render();
    config.onPanResponderRelease({}, { dx: 90, dy: 10 });
    expect(back).toHaveBeenCalledTimes(1);
  });

  test('short, leftward, or mostly vertical movements do not go back', async () => {
    bridge.installIosBackBridge();
    const back = jest.fn(() => true);
    BackHandler.addEventListener('hardwareBackPress', back);
    await render();
    config.onPanResponderRelease({}, { dx: 30, dy: 0 });
    config.onPanResponderRelease({}, { dx: -90, dy: 0 });
    config.onPanResponderRelease({}, { dx: 90, dy: 120 });
    expect(back).not.toHaveBeenCalled();
  });

  test('on a top level screen with nothing to go back from, the swipe does nothing', async () => {
    bridge.installIosBackBridge();
    await render();
    expect(() =>
      config.onPanResponderRelease({}, { dx: 90, dy: 0 }),
    ).not.toThrow();
  });
});

describe('the left edge swipe with a sliding screen on top', () => {
  type Config = {
    onPanResponderGrant: () => void;
    onPanResponderMove: (
      event: unknown,
      gesture: { dx: number; dy: number },
    ) => void;
    onPanResponderRelease: (
      event: unknown,
      gesture: { dx: number; dy: number; vx?: number },
    ) => void;
    onPanResponderTerminate: () => void;
  };
  let config: Config;
  let tree: Renderer.ReactTestRenderer;
  const entry = { drag: jest.fn(), release: jest.fn() };
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(PanResponder, 'create').mockImplementation(((given: unknown) => {
      config = given as Config;
      return { panHandlers: {} };
    }) as unknown as typeof PanResponder.create);
    registerSlide(entry);
    await act(async () => {
      tree = Renderer.create(<bridge.EdgeBackSwipe />);
    });
  });
  afterEach(async () => {
    resetSlides();
    await act(async () => tree.unmount());
  });

  test('the screen on top follows the finger while it is dragged', () => {
    config.onPanResponderGrant();
    config.onPanResponderMove({}, { dx: 30, dy: 2 });
    config.onPanResponderMove({}, { dx: 90, dy: 4 });
    expect(entry.drag.mock.calls).toEqual([[30], [90]]);
  });

  test('letting go after a long drag goes back; after a short one it snaps back', () => {
    config.onPanResponderGrant();
    config.onPanResponderRelease({}, { dx: 300, dy: 5, vx: 0 });
    expect(entry.release).toHaveBeenLastCalledWith(true);
    config.onPanResponderGrant();
    config.onPanResponderRelease({}, { dx: 40, dy: 5, vx: 0 });
    expect(entry.release).toHaveBeenLastCalledWith(false);
  });

  test('a quick flick goes back even after a short drag', () => {
    config.onPanResponderGrant();
    config.onPanResponderRelease({}, { dx: 50, dy: 0, vx: 0.8 });
    expect(entry.release).toHaveBeenLastCalledWith(true);
  });

  test('a mostly vertical movement never goes back', () => {
    config.onPanResponderGrant();
    config.onPanResponderRelease({}, { dx: 300, dy: 300, vx: 0.8 });
    expect(entry.release).toHaveBeenLastCalledWith(false);
  });

  test('an interrupted drag snaps the screen back', () => {
    config.onPanResponderGrant();
    config.onPanResponderTerminate();
    expect(entry.release).toHaveBeenLastCalledWith(false);
  });

  test('without a sliding screen the swipe goes back straight away through the registered handlers', () => {
    resetSlides();
    bridge.installIosBackBridge();
    const back = jest.fn(() => true);
    BackHandler.addEventListener('hardwareBackPress', back);
    config.onPanResponderGrant();
    config.onPanResponderRelease({}, { dx: 90, dy: 5, vx: 0 });
    expect(back).toHaveBeenCalledTimes(1);
    expect(entry.release).not.toHaveBeenCalled();
  });
});
