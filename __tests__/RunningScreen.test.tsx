import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { RunningScreen } from '../src/screens/run/RunningScreen';
import type { RunContext, RunSessionSnapshot } from '../src/types/runSession';
const mockSession = {
  phase: 'running',
  elapsedSec: 600,
  distanceKm: 2,
  speedKmh: 10,
  calories: 120,
  gpsStatus: 'tracking',
  error: '',
  busy: false,
  begin: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
  cancel: jest.fn(),
  finish: jest.fn(),
};
jest.mock('../src/hooks/useRunSession', () => ({
  useRunSession: () => mockSession,
}));
jest.mock('../src/components/character/CharacterView', () => ({
  CharacterView: () => null,
}));
jest.mock('../src/components/character/SpeechBubble', () => ({
  SpeechBubble: () => null,
}));
jest.mock('../src/components/scene/RunningWorld', () => ({
  RunningWorld: () => null,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
}));
jest.mock(
  'lucide-react-native',
  () => new Proxy({}, { get: () => () => null }),
);
const context = {
  uid: 'test',
  sessionKey: 'test-run',
  goal: { goalType: 'free', goalValue: null },
  before: { stageBefore: 'baby', totalKmBefore: 0, wasFrozen: false },
  weightKg: 60,
} as RunContext;
const restore = { context, phase: 'running' } as RunSessionSnapshot;
let tree: Renderer.ReactTestRenderer;
function screen() {
  return (
    <RunningScreen
      context={context}
      restore={restore}
      goalType="free"
      goalValue={null}
      characterType="rabbit"
      characterStage="baby"
      weightKg={60}
      onFinish={jest.fn()}
      onCancel={jest.fn()}
    />
  );
}
async function render() {
  await act(async () => {
    tree = Renderer.create(screen());
  });
}
function value(label: string) {
  return tree.root.findByProps({ label }).props.value;
}
beforeEach(() => {
  Object.assign(mockSession, {
    phase: 'running',
    speedKmh: 10,
    gpsStatus: 'tracking',
  });
});
afterEach(async () => {
  await act(() => tree?.unmount());
});

test('the row presents time, current pace, average pace and calories in order', async () => {
  await render();
  const labels = ['시간', '현재 페이스', '평균 페이스', '칼로리'];
  expect(
    tree.root
      .findAll(node => labels.includes(node.props.label))
      .map(node => node.props.label),
  ).toEqual(labels);
  expect(value('시간')).toBe('10:00');
  expect(value('현재 페이스')).toBe('6\'00"');
  expect(value('평균 페이스')).toBe('5\'00"');
  mockSession.speedKmh = 15;
  await act(() => tree.update(screen()));
  expect(value('현재 페이스')).toBe('4\'00"');
  expect(value('평균 페이스')).toBe('5\'00"');
});
test.each([
  [6, '10\'00"'],
  [12, '5\'00"'],
  [7, '8\'34"'],
])(
  'current %s km/h uses instantaneous speed with rounded seconds',
  async (speed, expected) => {
    mockSession.speedKmh = speed as number;
    await render();
    expect(value('현재 페이스')).toBe(expected);
  },
);
test.each([0, -1, NaN, Infinity])(
  'unavailable speed %s shows a dash while average remains available',
  async speed => {
    mockSession.speedKmh = speed;
    await render();
    expect(value('현재 페이스')).toBe('—');
    expect(value('평균 페이스')).toBe('5\'00"');
  },
);
test.each([
  { phase: 'paused', gpsStatus: 'tracking' },
  { phase: 'ready', gpsStatus: 'tracking' },
  { phase: 'running', gpsStatus: 'error' },
  { phase: 'running', gpsStatus: 'denied' },
])('current pace is unavailable for $phase/$gpsStatus', async state => {
  Object.assign(mockSession, state);
  await render();
  expect(value('현재 페이스')).toBe('—');
  expect(value('평균 페이스')).toBe('5\'00"');
});
