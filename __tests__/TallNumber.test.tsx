import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Renderer, { act } from 'react-test-renderer';
import { TallNumber } from '../src/components/ui/TallNumber';

let tree: Renderer.ReactTestRenderer;
afterEach(async () => {
  await act(async () => tree.unmount());
});

async function render(fontSize: number, lineHeight: number) {
  await act(async () => {
    tree = Renderer.create(
      <TallNumber fontSize={fontSize} lineHeight={lineHeight}>
        1.6
      </TallNumber>,
    );
  });
  const text = StyleSheet.flatten(tree.root.findByType(Text).props.style);
  const box = StyleSheet.flatten(tree.root.findAllByType(View)[0].props.style);
  return { text, box };
}

test('the number is stretched slightly taller (1.07x) while its width stays the same', async () => {
  const { text } = await render(64, 74);
  expect(text.transform).toEqual([{ scaleY: 1.07 }]);
  expect(text.fontSize).toBe(64);
  expect(text.lineHeight).toBe(74);
});

test('it grows upward from the baseline, so a unit beside it stays on the same line', async () => {
  const { text } = await render(64, 74);
  const [x, y] = text.transformOrigin as [string, number, number];
  expect(x).toBe('0%');
  // Pretendard: 바닥선 위 1950/2048, 아래 494/2048. 줄 높이와의 차이는 위아래로 반씩 나눈다
  const expected = (74 - ((1950 + 494) / 2048) * 64) / 2 + (1950 / 2048) * 64;
  expect(y).toBeCloseTo(expected, 5);
});

test('it leaves room above for the extra height so it does not overlap the label above', async () => {
  const { box } = await render(50, 62);
  // 숫자 높이(1448/2048)의 늘어난 0.07만큼
  expect(box.paddingTop).toBeCloseTo(0.07 * (1448 / 2048) * 50, 5);
});
