import AsyncStorage from '@react-native-async-storage/async-storage';
import { StyleSheet } from 'react-native';
import {
  colors,
  getThemeMode,
  setThemeMode,
  statusBarOnPrimary,
  statusBarStyle,
  switchColors,
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

test('the app starts in the light theme with the brand blue', () => {
  expect(getThemeMode()).toBe('light');
  expect(colors.primary).toBe('#0A66C2');
  expect(colors.background).toBe('#FFFFFF');
  expect(statusBarStyle()).toBe('dark-content');
});

test('switching to dark changes every color in place and the status bar text turns light', () => {
  const sameObject = colors;
  setThemeMode('dark');
  expect(colors).toBe(sameObject);
  expect(colors.background).toBe('#131920');
  expect(colors.text).toBe('#F0F3F6');
  expect(statusBarStyle()).toBe('light-content');
  setThemeMode('light');
  expect(colors.background).toBe('#FFFFFF');
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
  expect(StyleSheet.flatten(styles.screen).backgroundColor).toBe('#FFFFFF');
  setThemeMode('dark');
  expect(StyleSheet.flatten(styles.screen).backgroundColor).toBe('#131920');
  expect(styles.text.color).toBe('#F0F3F6');
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

test.each(['light', 'dark'] as const)(
  'in the %s theme every page has the same background, and only floating things are lifted',
  theme => {
    setThemeMode(theme);
    expect(colors.surface).toBe(colors.background);
    if (theme === 'light') {
      expect(colors.background).toBe('#FFFFFF');
      return;
    }
    expect(colors.background).toBe('#131920');
    expect(colors.surfaceRaised).not.toBe(colors.background);
    // 어두운 회색 단계는 모두 같은 푸른 기운(파랑이 가장 세고 빨강이 가장 약함)이고, 채도는 낮다.
    // 화면마다 서로 다른 색이 섞여 보이지 않게
    for (const gray of [
      colors.background,
      colors.surfaceRaised,
      colors.surfaceMuted,
      colors.border,
    ]) {
      const [r, g, b] = [1, 3, 5].map(i => parseInt(gray.slice(i, i + 2), 16));
      expect(b).toBeGreaterThanOrEqual(g);
      expect(g).toBeGreaterThanOrEqual(r);
      expect(b - r).toBeLessThanOrEqual(24);
    }
  },
);

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

test('in dark mode the main button is bright against the dark background, not a dim blue', () => {
  setThemeMode('dark');
  expect(
    contrast(colors.primaryAction, colors.background),
  ).toBeGreaterThanOrEqual(3);
  expect(contrast(colors.primaryInk, colors.background)).toBeGreaterThanOrEqual(
    7,
  );
  // 두 테마 모두 주조색 위 글자가 흰색이라 상태 표시줄 글자도 흰색
  expect(colors.textOnPrimary).toBe('#FFFFFF');
  expect(statusBarOnPrimary()).toBe('light-content');
  setThemeMode('light');
  expect(statusBarOnPrimary()).toBe('light-content');
});

test('in dark mode the summary band clearly stands out from the background and its text stays readable', () => {
  setThemeMode('dark');
  expect(
    contrast(colors.secondarySoft, colors.background),
  ).toBeGreaterThanOrEqual(1.5);
  expect(
    contrast(colors.textMuted, colors.secondarySoft),
  ).toBeGreaterThanOrEqual(4.5);
  expect(
    contrast(colors.primaryInk, colors.secondarySoft),
  ).toBeGreaterThanOrEqual(4.5);
  expect(contrast(colors.text, colors.secondarySoft)).toBeGreaterThanOrEqual(7);
});

test.each(['light', 'dark'] as const)(
  'a switch that is on shows the main color, not the system green, in the %s theme',
  theme => {
    setThemeMode(theme);
    const on = switchColors(true);
    expect(on.thumbColor).toBe(colors.primary);
    expect(on.trackColor.true).toBe(colors.primaryBorder);
    expect(switchColors(false).thumbColor).not.toBe(colors.primary);
  },
);

// 반투명 색을 바탕 위에 얹었을 때 보이는 색
function over(rgba: string, background: string) {
  const [r, g, b, a] = rgba.match(/[\d.]+/g)!.map(Number);
  const base = [1, 3, 5].map(i => parseInt(background.slice(i, i + 2), 16));
  return `#${[r, g, b]
    .map((c, i) => Math.round(c * a + base[i] * (1 - a)))
    .map(c => c.toString(16).padStart(2, '0'))
    .join('')}`;
}

test.each(['light', 'dark'] as const)(
  'in the %s theme the unfilled part of a progress bar is soft and clearly apart from the filled part',
  theme => {
    setThemeMode(theme);
    // 경험치 막대가 놓이는 회색 띠, 하늘 띠, 화면 바탕 어디서든
    for (const background of [
      colors.surfaceMuted,
      colors.secondarySoft,
      colors.background,
    ]) {
      const track = over(colors.progressTrack, background);
      expect(contrast(colors.primary, track)).toBeGreaterThanOrEqual(1.8);
      // 바탕과는 살짝만 다르다(옅다)
      expect(contrast(track, background)).toBeLessThan(1.4);
    }
  },
);
