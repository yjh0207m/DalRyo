import {getRevealMode} from '../src/utils/reveal';

test('첫 달리기는 부화가 가장 우선이다', () => {
  expect(getRevealMode('egg', 'baby', 1.2, true)).toBe('hatch');
});
test('알 상태여도 거리가 0이면 부화하지 않는다', () => {
  expect(getRevealMode('egg', 'egg', 0, false)).toBe('complete');
});
test('돌 상태에서 달리면 성장보다 해동이 먼저다', () => {
  expect(getRevealMode('baby', 'child', 3, true)).toBe('thaw');
});
test('단계가 오르면 성장, 아니면 일반 완주', () => {
  expect(getRevealMode('baby', 'child', 3, false)).toBe('grow');
  expect(getRevealMode('child', 'child', 3, false)).toBe('complete');
});
