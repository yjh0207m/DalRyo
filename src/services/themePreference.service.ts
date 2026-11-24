import AsyncStorage from '@react-native-async-storage/async-storage';
import { setThemeMode, type ThemeMode } from '../theme';

// 다크 모드는 기기 화면 설정이라 계정이 아니라 이 기기에 저장한다. 로그아웃해도 그대로다
const KEY = '@dalryo/theme-mode/v1';

// 저장된 테마를 불러와 바로 적용한다. 저장된 값이 없거나 읽지 못하면 밝은 테마로 둔다
export async function restoreThemePreference(): Promise<ThemeMode> {
  let saved: ThemeMode = 'light';
  try {
    saved = (await AsyncStorage.getItem(KEY)) === 'dark' ? 'dark' : 'light';
  } catch {
    // 읽지 못해도 앱은 밝은 테마로 계속 쓸 수 있다
  }
  setThemeMode(saved);
  return saved;
}

// 고른 테마를 이 기기에 저장한다. 화면은 setThemeMode로 먼저 바꾸고 저장은 기다리지 않는다.
// 저장에 실패하면 지금은 그대로 쓰고, 다음 실행 때 이전 테마로 시작한다
export function saveThemePreference(next: ThemeMode) {
  return AsyncStorage.setItem(KEY, next);
}
