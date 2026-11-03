import {
  adjacentTab,
  isHorizontalDrag,
  isTabSwipe,
  startsInSwipeZone,
  SWIPE_TAB_ORDER,
} from '../src/navigation/tabSwipe';

describe('tab order', () => {
  test('follows the bottom bar from left to right, without the run button', () => {
    expect(SWIPE_TAB_ORDER).toEqual(['home', 'growth', 'community', 'records']);
  });

  test('swiping right to left goes home → growth → community → records and stops at the end', () => {
    expect(adjacentTab('home', 'next')).toBe('growth');
    expect(adjacentTab('growth', 'next')).toBe('community');
    expect(adjacentTab('community', 'next')).toBe('records');
    expect(adjacentTab('records', 'next')).toBeNull();
  });

  test('swiping left to right goes records → community → growth → home and stops at the start', () => {
    expect(adjacentTab('records', 'previous')).toBe('community');
    expect(adjacentTab('community', 'previous')).toBe('growth');
    expect(adjacentTab('growth', 'previous')).toBe('home');
    expect(adjacentTab('home', 'previous')).toBeNull();
  });

  test('a tab that is not part of the swipe order has no neighbours', () => {
    expect(adjacentTab('run', 'next')).toBeNull();
  });
});

describe('what counts as a horizontal drag', () => {
  test('a drag is taken over only when it is clearly sideways', () => {
    expect(isHorizontalDrag({ dx: 30, dy: 5 })).toBe(true);
    expect(isHorizontalDrag({ dx: -30, dy: 5 })).toBe(true);
    expect(isHorizontalDrag({ dx: 10, dy: 0 })).toBe(false);
    // 세로 스크롤 중 살짝 흔들리는 정도는 가로로 보지 않는다
    expect(isHorizontalDrag({ dx: 30, dy: 25 })).toBe(false);
    expect(isHorizontalDrag({ dx: 5, dy: 80 })).toBe(false);
  });
});

describe('when letting go moves on to the next tab', () => {
  const WIDTH = 400;

  test('dragging a fifth of the screen width or more is enough', () => {
    expect(isTabSwipe({ dx: -80, dy: 0 }, WIDTH)).toBe(true);
    expect(isTabSwipe({ dx: 120, dy: -10 }, WIDTH)).toBe(true);
    expect(isTabSwipe({ dx: -79, dy: 0 }, WIDTH)).toBe(false);
  });

  test('a short but fast flick in the direction of the drag also counts', () => {
    expect(isTabSwipe({ dx: -40, dy: 0, vx: -0.5 }, WIDTH)).toBe(true);
    expect(isTabSwipe({ dx: 40, dy: 0, vx: 0.5 }, WIDTH)).toBe(true);
    // 너무 짧거나, 빠르게 튕겼어도 방향이 반대로 끝났으면 아니다
    expect(isTabSwipe({ dx: -10, dy: 0, vx: -0.9 }, WIDTH)).toBe(false);
    expect(isTabSwipe({ dx: -40, dy: 0, vx: 0.9 }, WIDTH)).toBe(false);
  });

  test('a drag that is mostly vertical never counts, however far it went', () => {
    expect(isTabSwipe({ dx: -150, dy: 100 }, WIDTH)).toBe(false);
    expect(isTabSwipe({ dx: -150, dy: 80 }, WIDTH)).toBe(false);
    expect(isTabSwipe({ dx: -150, dy: 60 }, WIDTH)).toBe(true);
  });
});

describe('where a swipe may start', () => {
  const W = 390;
  test('the left and right thirds of the screen can swipe', () => {
    for (const x of [0, 60, 129, 261, 330, 390])
      expect(startsInSwipeZone(x, W)).toBe(true);
  });

  test('the middle third, where the community sub navigation sits, cannot', () => {
    for (const x of [131, 195, 259])
      expect(startsInSwipeZone(x, W)).toBe(false);
  });
});
