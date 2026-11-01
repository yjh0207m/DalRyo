import React from 'react';
import { Image, StyleSheet } from 'react-native';
import Renderer, { act } from 'react-test-renderer';
import { FullPhoto } from '../src/components/ui/FullPhoto';

let sizes: Record<string, [number, number]> = {};
let tree: Renderer.ReactTestRenderer;
beforeEach(() => {
  sizes = {};
  jest.spyOn(Image, 'getSize').mockImplementation(((
    uri: string,
    success: (w: number, h: number) => void,
  ) => {
    const size = sizes[uri];
    if (size) success(size[0], size[1]);
  }) as typeof Image.getSize);
});
afterEach(async () => {
  jest.restoreAllMocks();
  await act(async () => tree.unmount());
});
async function render(uri: string) {
  await act(async () => {
    tree = Renderer.create(<FullPhoto uri={uri} />);
  });
}
const image = () => tree.root.findByType(Image);
const ratio = () => StyleSheet.flatten(image().props.style).aspectRatio;

test('shows the whole photo: original ratio with contain, never cover', async () => {
  sizes['https://x/card.jpg'] = [1080, 1350];
  await render('https://x/card.jpg');
  expect(image().props.resizeMode).toBe('contain');
  expect(ratio()).toBeCloseTo(0.8);
});

test('uses a wide photo ratio as is', async () => {
  sizes['https://x/wide.jpg'] = [1600, 900];
  await render('https://x/wide.jpg');
  expect(ratio()).toBeCloseTo(16 / 9);
});

test('limits extreme ratios but still contains the photo so nothing is cropped', async () => {
  sizes['https://x/tall.jpg'] = [100, 1000];
  await render('https://x/tall.jpg');
  expect(ratio()).toBe(0.5);
  expect(image().props.resizeMode).toBe('contain');
  await act(async () => tree.unmount());
  sizes['https://x/pano.jpg'] = [4000, 500];
  await render('https://x/pano.jpg');
  expect(ratio()).toBe(2);
});

test('falls back to the 4:5 card ratio while the size is unknown or unreadable', async () => {
  await render('https://x/unknown.jpg');
  expect(ratio()).toBeCloseTo(0.8);
});
