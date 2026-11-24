import AsyncStorage from '@react-native-async-storage/async-storage';
import { StyleSheet } from 'react-native';
import {
  colors,
  getThemeMode,
  setThemeMode,
  statusBarOnPrimary,
  statusBarStyle,
  subscribeThemeMode,
  themedStyles,
} from '../src/theme';
import {
  restoreThemePreference,
  saveThemePreference,
} from '../src/services/themePreference.service';

const KEY = '@dalryo/theme-mode/v1';

afterEach(async () => {
  setThemeMode('light');
  await AsyncStorage.clear();
});

test('the app starts in the light theme with the brand mint', () => {
  expect(getThemeMode()).toBe('light');
  expect(colors.primary).toBe('#22B48F');
  expect(colors.background).toBe('#F5F7F6');
  expect(statusBarStyle()).toBe('dark-content');
});

test('switching to dark changes every color in place and the status bar text turns light', () => {
  const sameObject = colors;
  setThemeMode('dark');
  expect(colors).toBe(sameObject);
  expect(colors.background).toBe('#000000');
  expect(colors.text).toBe('#F5F5F7');
  expect(statusBarStyle()).toBe('light-content');
  setThemeMode('light');
  expect(colors.background).toBe('#F5F7F6');
});

test('the dark palette defines a color for every light color', () => {
  const lightKeys = Object.keys(colors).sort();
  setThemeMode('dark');
  expect(Object.keys(colors).sort()).toEqual(lightKeys);
  expect(Object.values(colors).every(value => typeof value === 'string')).toBe(
    true,
  );
});

test('themed styles are rebuilt with the new colors after the theme changes', () => {
  const styles = themedStyles(() => ({
    screen: { flex: 1, backgroundColor: colors.background },
    text: { color: colors.text },
  }));
  expect(StyleSheet.flatten(styles.screen).backgroundColor).toBe('#F5F7F6');
  setThemeMode('dark');
  expect(StyleSheet.flatten(styles.screen).backgroundColor).toBe('#000000');
  expect(styles.text.color).toBe('#F5F5F7');
  // 레이아웃 값은 그대로다
  expect(styles.screen.flex).toBe(1);
});

test('themed styles are not rebuilt while the theme stays the same', () => {
  const make = jest.fn(() => ({ box: { backgroundColor: colors.surface } }));
  const styles = themedStyles(make);
  expect(make).not.toHaveBeenCalled();
  expect(styles.box).toBeDefined();
  expect(styles.box).toBeDefined();
  expect(make).toHaveBeenCalledTimes(1);
  setThemeMode('dark');
  expect(styles.box).toBeDefined();
  expect(make).toHaveBeenCalledTimes(2);
});

test('listeners hear about a real change only', () => {
  const listener = jest.fn();
  const stop = subscribeThemeMode(listener);
  setThemeMode('light');
  expect(listener).not.toHaveBeenCalled();
  setThemeMode('dark');
  expect(listener).toHaveBeenCalledTimes(1);
  stop();
  setThemeMode('light');
  expect(listener).toHaveBeenCalledTimes(1);
});

test('the saved choice on this device is restored at launch', async () => {
  await saveThemePreference('dark');
  expect(await AsyncStorage.getItem(KEY)).toBe('dark');
  await expect(restoreThemePreference()).resolves.toBe('dark');
  expect(getThemeMode()).toBe('dark');
});

test('with nothing saved, or an unreadable store, the app stays light', async () => {
  await expect(restoreThemePreference()).resolves.toBe('light');
  expect(getThemeMode()).toBe('light');
  const spy = jest
    .spyOn(AsyncStorage, 'getItem')
    .mockRejectedValueOnce(new Error('disk'));
  await expect(restoreThemePreference()).resolves.toBe('light');
  spy.mockRestore();
});

// WCAG 상대 휘도 대비. 글자는 4.5:1, 버튼 같은 큰 면은 3:1 이상이 기준이다
function contrast(a: string, b: string) {
  const luminance = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map(i => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

test('in dark mode every page has the same black background, and only floating things are lifted', () => {
  setThemeMode('dark');
  expect(colors.background).toBe('#000000');
  expect(colors.surface).toBe(colors.background);
  expect(colors.surfaceRaised).not.toBe(colors.background);
  // 회색에 녹색 기운이 없다(R·G·B가 거의 같다)
  for (const gray of [
    colors.surfaceRaised,
    colors.surfaceMuted,
    colors.border,
  ]) {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(gray.slice(i, i + 2), 16));
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThanOrEqual(4);
  }
});

test.each(['light', 'dark'] as const)(
  'the mint stands out and its text stays readable in the %s theme',
  theme => {
    setThemeMode(theme);
    // 버튼 글자
    expect(
      contrast(colors.textOnPrimary, colors.primaryAction),
    ).toBeGreaterThanOrEqual(4.5);
    // 바탕 위 민트 글자
    expect(contrast(colors.primaryInk, colors.surface)).toBeGreaterThanOrEqual(
      4.5,
    );
    // 보조 글자
    expect(contrast(colors.textMuted, colors.surface)).toBeGreaterThanOrEqual(
      4.5,
    );
    // 버튼 면과 바탕
    expect(
      contrast(colors.primaryAction, colors.surface),
    ).toBeGreaterThanOrEqual(3);
  },
);

test('in dark mode the mint button is bright against black, not a dim green', () => {
  setThemeMode('dark');
  expect(
    contrast(colors.primaryAction, colors.background),
  ).toBeGreaterThanOrEqual(10);
  expect(contrast(colors.primaryInk, colors.background)).toBeGreaterThanOrEqual(
    7,
  );
  // 밝은 민트 위에서는 상태 표시줄 글자도 어둡게
  expect(statusBarOnPrimary()).toBe('dark-content');
  setThemeMode('light');
  expect(statusBarOnPrimary()).toBe('light-content');
});
