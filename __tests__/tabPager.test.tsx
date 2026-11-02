import React from 'react';
import { PanResponder, Text } from 'react-native';
import Renderer, { act } from 'react-test-renderer';
import { motion } from '../src/navigation/motion';
import {
  TabPagerView,
  useTabPager,
  type TabPager,
} from '../src/navigation/tabPager';
import type { MainTab } from '../src/navigation/BottomTabBar';

type Config = {
  onMoveShouldSetPanResponder: (
    event: unknown,
    gesture: { dx: number; dy: number },
  ) => boolean;
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
let pager: TabPager;
let tree: Renderer.ReactTestRenderer;
const onChange = jest.fn();

function Probe(props: { active: MainTab; enabled?: boolean }) {
  pager = useTabPager({
    active: props.active,
    enabled: props.enabled ?? true,
    onChange,
  });
  return (
    <TabPagerView
      pager={pager}
      renderTab={tab => <Text>{`${tab} 화면`}</Text>}
    />
  );
}
async function render(active: MainTab, enabled = true) {
  await act(async () => {
    tree = Renderer.create(<Probe active={active} enabled={enabled} />);
  });
}
const rerender = (active: MainTab, enabled = true) =>
  act(async () => {
    tree.update(<Probe active={active} enabled={enabled} />);
  });
const shown = () =>
  tree.root.findAllByType(Text).map(node => node.props.children as string);
const position = () =>
  (pager.position as unknown as { __getValue: () => number }).__getValue();
const move = (dx: number, dy = 0) =>
  act(async () => {
    config.onPanResponderMove({}, { dx, dy });
  });
const release = (dx: number, dy = 0, vx = 0) =>
  act(async () => {
    config.onPanResponderRelease({}, { dx, dy, vx });
  });
const grab = () =>
  act(async () => {
    config.onPanResponderGrant();
  });

beforeEach(() => {
  jest.clearAllMocks();
  const create = PanResponder.create.bind(PanResponder);
  jest.spyOn(PanResponder, 'create').mockImplementation(((given: Config) => {
    config = given;
    return create(given);
  }) as unknown as typeof PanResponder.create);
});
afterEach(async () => {
  motion.enabled = false;
  await act(async () => tree.unmount());
  jest.restoreAllMocks();
});

describe('at rest', () => {
  test('only the active tab is drawn, with no offset, and the position is its number', async () => {
    await render('growth');
    expect(shown()).toEqual(['growth 화면']);
    expect(position()).toBe(1);
  });

  test('a tab changed from outside (a notification, a deep link) simply appears without sliding', async () => {
    await render('home');
    await rerender('records');
    expect(shown()).toEqual(['records 화면']);
    expect(position()).toBe(3);
  });
});

describe('dragging with a finger', () => {
  test('a press is never taken over; only a clear sideways drag is', async () => {
    await render('home');
    expect(config.onMoveShouldSetPanResponder({}, { dx: 40, dy: 0 })).toBe(
      true,
    );
    expect(config.onMoveShouldSetPanResponder({}, { dx: 3, dy: 0 })).toBe(
      false,
    );
    expect(config.onMoveShouldSetPanResponder({}, { dx: 5, dy: 60 })).toBe(
      false,
    );
  });

  test('dragging left brings the next tab in beside the current one and the position follows the finger', async () => {
    await render('growth');
    await grab();
    await move(-pager.width / 2);
    expect(shown().sort()).toEqual(['community 화면', 'growth 화면']);
    expect(position()).toBeCloseTo(1.5);
    await move(-pager.width / 4);
    expect(position()).toBeCloseTo(1.25);
  });

  test('dragging right brings the previous tab in', async () => {
    await render('growth');
    await grab();
    await move(pager.width / 2);
    expect(shown().sort()).toEqual(['growth 화면', 'home 화면']);
    expect(position()).toBeCloseTo(0.5);
  });

  test('the position never goes more than one tab away from the active one', async () => {
    await render('growth');
    await grab();
    await move(-pager.width * 3);
    expect(position()).toBe(2);
  });

  test('past the first or last tab there is nothing to bring in and the drag resists', async () => {
    await render('home');
    await grab();
    await move(pager.width / 2);
    expect(shown()).toEqual(['home 화면']);
    expect(position()).toBeLessThan(0);
    expect(position()).toBeGreaterThan(-0.5 / 2);
    await release(pager.width / 2);
    expect(onChange).not.toHaveBeenCalled();
    expect(position()).toBe(0);
  });

  test('turning the finger around swaps which neighbour is drawn', async () => {
    await render('growth');
    await grab();
    await move(-100);
    expect(shown()).toContain('community 화면');
    await move(100);
    expect(shown()).toContain('home 화면');
    expect(shown()).not.toContain('community 화면');
  });
});

describe('letting go', () => {
  test('far enough moves on to that tab and only that tab remains', async () => {
    await render('growth');
    await grab();
    await move(-pager.width * 0.4);
    await release(-pager.width * 0.4);
    expect(onChange).toHaveBeenCalledWith('community');
    expect(onChange).toHaveBeenCalledTimes(1);
    await rerender('community');
    expect(shown()).toEqual(['community 화면']);
    expect(position()).toBe(2);
  });

  test('right to left goes forward and left to right goes back, one tab at a time', async () => {
    await render('community');
    await release(-pager.width * 0.4);
    expect(onChange).toHaveBeenLastCalledWith('records');
    await release(pager.width * 0.4);
    expect(onChange).toHaveBeenLastCalledWith('growth');
  });

  test('not far enough returns to where it was without changing tab', async () => {
    await render('growth');
    await grab();
    await move(-pager.width * 0.1);
    await release(-pager.width * 0.1);
    expect(onChange).not.toHaveBeenCalled();
    expect(shown()).toEqual(['growth 화면']);
    expect(position()).toBe(1);
  });

  test('a quick flick is enough even if the finger did not travel far', async () => {
    await render('growth');
    await release(-40, 0, -0.6);
    expect(onChange).toHaveBeenCalledWith('community');
  });

  test('a mostly vertical drag does not change tab', async () => {
    await render('growth');
    await release(-pager.width * 0.5, pager.width * 0.4);
    expect(onChange).not.toHaveBeenCalled();
  });

  test('an interrupted drag (another view took the touch) settles back', async () => {
    await render('growth');
    await grab();
    await move(-pager.width * 0.4);
    await act(async () => {
      config.onPanResponderTerminate();
    });
    expect(onChange).not.toHaveBeenCalled();
    expect(shown()).toEqual(['growth 화면']);
    expect(position()).toBe(1);
  });

  test('while disabled (a sub screen is open) nothing is taken over and nothing changes', async () => {
    await render('community', false);
    expect(config.onMoveShouldSetPanResponder({}, { dx: 80, dy: 0 })).toBe(
      false,
    );
    await release(-pager.width * 0.5);
    expect(onChange).not.toHaveBeenCalled();
    await rerender('community', true);
    await release(-pager.width * 0.5);
    expect(onChange).toHaveBeenCalledWith('records');
  });
});

describe('tapping a tab in the bar', () => {
  test('moves to that tab through the same settling', async () => {
    await render('home');
    await act(async () => pager.goTo('growth'));
    expect(onChange).toHaveBeenCalledWith('growth');
  });

  test('also works for a tab several steps away', async () => {
    await render('home');
    await act(async () => pager.goTo('records'));
    expect(onChange).toHaveBeenCalledWith('records');
  });

  test('tapping the tab that is already active does nothing', async () => {
    await render('growth');
    await act(async () => pager.goTo('growth'));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('with animation on', () => {
  beforeEach(() => {
    motion.enabled = true;
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  test('tapping a tab draws both tabs while sliding and finishes by changing the tab', async () => {
    await render('home');
    await act(async () => pager.goTo('growth'));
    expect(shown().sort()).toEqual(['growth 화면', 'home 화면']);
    expect(onChange).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(600);
    });
    expect(onChange).toHaveBeenCalledWith('growth');
    await rerender('growth');
    expect(shown()).toEqual(['growth 화면']);
    expect(position()).toBe(1);
  });
});
