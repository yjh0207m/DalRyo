import React from 'react';
import {
  Animated,
  BackHandler,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import Renderer, { act } from 'react-test-renderer';
import {
  installIosBackBridge,
  resetBackBridge,
} from '../src/navigation/backGesture';
import { motion } from '../src/navigation/motion';
import { SlideScreen } from '../src/navigation/slide';
import { resetSlides, topSlide } from '../src/navigation/slideRegistry';

let tree: Renderer.ReactTestRenderer;
let width = 0;
function Width() {
  width = useWindowDimensions().width;
  return null;
}
const offset = () => {
  const nodes = tree.root.findAllByType(Animated.View);
  const style = StyleSheet.flatten(nodes[0].props.style);
  const x = style.transform[0].translateX as unknown as
    | { __getValue: () => number }
    | number;
  return typeof x === 'number' ? x : x.__getValue();
};
const onBack = jest.fn();
let back: () => void;
async function render(animateIn = true) {
  await act(async () => {
    tree = Renderer.create(
      <>
        <Width />
        <SlideScreen onBack={onBack} animateIn={animateIn}>
          {close => {
            back = close;
            return null;
          }}
        </SlideScreen>
      </>,
    );
  });
}
beforeEach(() => {
  jest.clearAllMocks();
  installIosBackBridge();
});
afterEach(async () => {
  motion.enabled = false;
  resetBackBridge();
  resetSlides();
  await act(async () => tree.unmount());
  jest.useRealTimers();
});

describe('a screen that slides in over another', () => {
  test('ends up in place, and closing it calls onBack once', async () => {
    await render();
    expect(offset()).toBe(0);
    await act(async () => back());
    await act(async () => back());
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  test('with animation on it starts off to the right and only calls onBack after sliding out', async () => {
    motion.enabled = true;
    jest.useFakeTimers();
    await render();
    // 네이티브로 움직이는 값은 테스트에서 JS 쪽 숫자가 갱신되지 않으므로, 시작 위치와 끝난 뒤의 호출만 확인한다
    expect(offset()).toBe(width);
    await act(async () => {
      jest.advanceTimersByTime(600);
    });
    await act(async () => back());
    expect(onBack).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(600);
    });
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  test('a screen that was already open when the app started does not slide in', async () => {
    motion.enabled = true;
    await render(false);
    expect(offset()).toBe(0);
  });
});

describe('dragging it from the left edge', () => {
  test('the newest screen is the one that is dragged, and it follows the finger but never past the right edge', async () => {
    await render();
    const entry = topSlide()!;
    await act(async () => entry.drag(120));
    expect(offset()).toBe(120);
    await act(async () => entry.drag(-50));
    expect(offset()).toBe(0);
    await act(async () => entry.drag(width * 3));
    expect(offset()).toBe(width);
  });

  test('letting go without enough movement snaps back and does not close', async () => {
    await render();
    const entry = topSlide()!;
    await act(async () => entry.drag(40));
    await act(async () => entry.release(false));
    expect(offset()).toBe(0);
    expect(onBack).not.toHaveBeenCalled();
  });

  test('letting go far enough asks the screen to go back, so a screen with a confirmation still gets to ask', async () => {
    await render();
    const goBack = jest.fn(() => {
      back();
      return true;
    });
    BackHandler.addEventListener('hardwareBackPress', goBack);
    const entry = topSlide()!;
    await act(async () => entry.drag(200));
    await act(async () => entry.release(true));
    expect(goBack).toHaveBeenCalledTimes(1);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  test('if the screen answers with a confirmation instead of closing, it slides back into place', async () => {
    await render();
    const confirm = jest.fn(() => true);
    BackHandler.addEventListener('hardwareBackPress', confirm);
    const entry = topSlide()!;
    await act(async () => entry.drag(200));
    await act(async () => entry.release(true));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(onBack).not.toHaveBeenCalled();
    expect(offset()).toBe(0);
  });

  test('once it is closing, further drags and releases are ignored', async () => {
    await render();
    const entry = topSlide()!;
    await act(async () => back());
    await act(async () => entry.drag(10));
    await act(async () => entry.release(true));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe('several screens stacked', () => {
  test('the one opened last is on top, and the one below becomes the top again when it goes away', async () => {
    const lower = jest.fn();
    const upper = jest.fn();
    await act(async () => {
      tree = Renderer.create(
        <>
          <Width />
          <SlideScreen key="lower" onBack={lower}>
            {() => null}
          </SlideScreen>
        </>,
      );
    });
    const lowerEntry = topSlide();
    await act(async () => {
      tree.update(
        <>
          <Width />
          <SlideScreen key="lower" onBack={lower}>
            {() => null}
          </SlideScreen>
          <SlideScreen key="upper" onBack={upper}>
            {() => null}
          </SlideScreen>
        </>,
      );
    });
    const upperEntry = topSlide();
    expect(upperEntry).not.toBe(lowerEntry);
    await act(async () => {
      tree.update(
        <>
          <Width />
          <SlideScreen key="lower" onBack={lower}>
            {() => null}
          </SlideScreen>
        </>,
      );
    });
    expect(topSlide()).toBe(lowerEntry);
  });
});
