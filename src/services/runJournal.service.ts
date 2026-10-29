import AsyncStorage from '@react-native-async-storage/async-storage';
import {NativeModules, Platform} from 'react-native';
import type {RunContext, RunSessionSnapshot} from '../types/runSession';

type NativeTracker = {
  current(uid: string): Promise<string | null>;
  start(context: string): Promise<string>;
  command(uid: string, startedAt: number, action: string): Promise<string | null>;
};
export const nativeRunTracker: NativeTracker | undefined = Platform.OS === 'android' ? NativeModules.RunTracking : undefined;
const key = (uid: string) => `@dalryo/active-run/v1/${uid}`;
let writes: Promise<unknown> = Promise.resolve();
export function writeFallbackSession(snapshot: RunSessionSnapshot | null, uid: string): Promise<void> {
  const value = snapshot ? JSON.stringify(snapshot) : null;
  const pending = writes.catch(() => {}).then(() => value === null ? AsyncStorage.removeItem(key(uid)) : AsyncStorage.setItem(key(uid), value));
  writes = pending;
  return pending;
}
export async function readActiveRun(uid: string): Promise<RunSessionSnapshot | null> {
  if (Platform.OS === 'android' && !nativeRunTracker) throw new Error('새 앱을 설치해야 달리기 기록을 사용할 수 있어요.');
  const raw = nativeRunTracker ? await nativeRunTracker.current(uid) : await AsyncStorage.getItem(key(uid));
  if (!raw) return null;
  const state = JSON.parse(raw) as RunSessionSnapshot;
  if (state.version !== 1 || state.context?.uid !== uid || !['running', 'paused', 'finished'].includes(state.phase) || !Number.isFinite(state.startedAtMs) || !Number.isFinite(state.elapsedMs) || state.elapsedMs < 0 || !Number.isFinite(state.distanceKm) || state.distanceKm < 0 || !Array.isArray(state.route)) throw new Error('복구 기록을 확인하지 못했어요.');
  if (!nativeRunTracker && state.phase === 'running') return {...state, phase: 'paused', interrupted: true, speedKmh: 0};
  return state;
}
export async function startNativeRun(context: RunContext) {
  if (!nativeRunTracker) throw new Error('달리기 서비스를 찾을 수 없어요.');
  return JSON.parse(await nativeRunTracker.start(JSON.stringify(context))) as RunSessionSnapshot;
}
export async function commandRun(state: RunSessionSnapshot, action: 'pause' | 'resume' | 'finish' | 'clear') {
  if (nativeRunTracker) {
    const raw = await nativeRunTracker.command(state.context.uid, state.startedAtMs, action);
    return raw ? JSON.parse(raw) as RunSessionSnapshot : null;
  }
  const next = action === 'clear' ? null : {...state, phase: action === 'finish' ? 'finished' as const : action === 'resume' ? 'running' as const : 'paused' as const};
  await writeFallbackSession(next, state.context.uid);
  return next;
}
