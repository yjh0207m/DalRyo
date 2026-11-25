import React from 'react';
import { StyleSheet, Text } from 'react-native';
import Renderer, { act } from 'react-test-renderer';
import { Chip } from '../src/components/ui/Chip';
import { colors, setThemeMode } from '../src/theme';

let tree: Renderer.ReactTestRenderer;
afterEach(async () => {
  await act(async () => tree.unmount());
  setThemeMode('light');
});

async function render(props: Partial<React.ComponentProps<typeof Chip>> = {}) {
  const onPress = jest.fn();
  await act(async () => {
    tree = Renderer.create(
      <Chip label="경기" selected={false} onPress={onPress} {...props} />,
    );
  });
  const pressable = tree.root.find(
    node =>
      typeof node.props.onPress === 'function' &&
      !!node.props.accessibilityRole,
  );
  const style = StyleSheet.flatten(pressable.props.style({ pressed: false }));
  const text = StyleSheet.flatten(tree.root.findByType(Text).props.style);
  return { onPress, pressable, style, text };
}

test.each(['light', 'dark'] as const)(
  'a chosen chip looks the same everywhere in the %s theme: soft mint fill, mint border and mint text',
  async theme => {
    setThemeMode(theme);
    const { style, text } = await render({ selected: true });
    expect(style.backgroundColor).toBe(colors.primarySoft);
    expect(style.borderColor).toBe(colors.primary);
    expect(text.color).toBe(colors.primaryInk);
  },
);

test('an unchosen chip has only a border and plain text', async () => {
  const { style, text } = await render();
  expect(style.backgroundColor).toBeUndefined();
  expect(style.borderColor).toBe(colors.border);
  expect(text.color).toBe(colors.text);
});

test('it reads as a choice and reports its state', async () => {
  const { pressable, onPress } = await render({ selected: true });
  expect(pressable.props.accessibilityRole).toBe('radio');
  expect(pressable.props.accessibilityState).toEqual({
    selected: true,
    disabled: false,
  });
  await act(async () => pressable.props.onPress());
  expect(onPress).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
  const checkbox = await render({ role: 'checkbox', selected: true });
  expect(checkbox.pressable.props.accessibilityState).toEqual({
    checked: true,
    disabled: false,
  });
});
