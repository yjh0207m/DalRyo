import {useCallback, useEffect, useRef, useState} from 'react';
import {AppState, PermissionsAndroid, Platform} from 'react-native';
import {requestLocationPermission, useGPS, type GpsStatus} from './useGPS';
import {commandRun, nativeRunTracker, readActiveRun, startNativeRun, writeFallbackSession} from '../services/runJournal.service';
import {RunAccumulator, sessionResult} from '../utils/runSession';
import type {RunContext, RunSessionSnapshot} from '../types/runSession';
import {estimateCalories} from '../utils/distance';
export type {RunResult} from '../types/runSession';
export type RunPhase = 'ready' | 'running' | 'paused' | 'finished';

export function useRunSession({context, restore}: {context: RunContext; restore?: RunSessionSnapshot}) {
  const [snapshot, setSnapshot] = useState<RunSessionSnapshot | null>(restore ?? null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const current = useRef<RunSessionSnapshot | null>(restore ?? null);
  const accumulator = useRef<RunAccumulator | null>(null);
  const contextRef = useRef(context); contextRef.current = context;
  const lock = useRef(false), alive = useRef(true), begun = useRef(false);
  const commit = useCallback((next: RunSessionSnapshot) => {current.current = next; if (alive.current) setSnapshot(next);}, []);
  const {status: fallbackStatus, start: startGPS, stop: stopGPS} = useGPS(fix => {
    if (!accumulator.current) return;
    accumulator.current.fix(fix);
    const next = accumulator.current.snapshot(); commit(next);
    writeFallbackSession(next, next.context.uid).catch(() => {if (alive.current) setError('기기에 기록을 보관하지 못했어요. 저장 공간을 확인해 주세요.');});
  });
  const begin = useCallback(async () => {
    if (begun.current || lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const granted = await requestLocationPermission();
      if (!granted) throw new Error('정확한 위치 권한을 허용한 뒤 다시 시작해 주세요.');
      if (!alive.current) return;
      if (Platform.OS === 'android') {
        if (!restore && Number(Platform.Version) >= 33) await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
        if (!alive.current) return;
        const next = restore ? await readActiveRun(contextRef.current.uid) : await startNativeRun(contextRef.current);
        if (!next) throw new Error('복구할 달리기를 찾지 못했어요.');
        if (!alive.current) {if (next.phase === 'running') await commandRun(next, 'pause'); return;}
        commit(next);
      } else {
        const now = Date.now();
        const saved = restore ?? {version: 1, context: contextRef.current, phase: 'running', startedAtMs: now, updatedAtMs: now,
          elapsedMs: 0, distanceKm: 0, speedKmh: 0, route: [], gpsStatus: 'tracking'} satisfies RunSessionSnapshot;
        accumulator.current = new RunAccumulator(saved, !!restore);
        if (accumulator.current.state.phase === 'running') await startGPS();
        const next = accumulator.current.snapshot(); await writeFallbackSession(next, next.context.uid); commit(next);
      }
      begun.current = true;
    } catch (failure) {if (alive.current) setError(failure instanceof Error ? failure.message : '달리기를 시작하지 못했어요.');}
    finally {lock.current = false; if (alive.current) setBusy(false);}
  }, [commit, restore, startGPS]);

  const change = useCallback(async (action: 'pause' | 'resume' | 'finish' | 'clear') => {
    if (lock.current || !current.current) return null;
    lock.current = true; setBusy(true); setError('');
    try {
      let next: RunSessionSnapshot | null;
      if (nativeRunTracker) next = await commandRun(current.current, action);
      else {
        if (action === 'resume') {if (!await startGPS()) throw new Error('위치 권한을 확인해 주세요.');}
        else stopGPS();
        next = action === 'clear' ? null : accumulator.current!.change(action === 'finish' ? 'finished' : action === 'resume' ? 'running' : 'paused');
        await writeFallbackSession(next, contextRef.current.uid);
      }
      if (next) commit(next); else current.current = null;
      return next;
    } catch (failure) {if (alive.current) setError(failure instanceof Error ? failure.message : '기록을 변경하지 못했어요.'); return null;}
    finally {lock.current = false; if (alive.current) setBusy(false);}
  }, [commit, startGPS, stopGPS]);

  useEffect(() => {
    alive.current = true;
    const refresh = async () => {
      if (!current.current || current.current.phase === 'finished' || lock.current) return;
      try {
        const next = nativeRunTracker ? await readActiveRun(contextRef.current.uid) : accumulator.current?.snapshot();
        if (next && alive.current && !lock.current) {commit(next); if (!nativeRunTracker) await writeFallbackSession(next, next.context.uid);}
      } catch {if (alive.current) setError('기기 기록을 확인하지 못했어요.');}
    };
    const timer = setInterval(refresh, 1000);
    const listener = AppState.addEventListener('change', state => {if (state === 'active') refresh();});
    return () => {alive.current = false; clearInterval(timer); listener.remove();};
  }, [commit]);
  return {
    phase: (snapshot?.phase ?? 'ready') as RunPhase,
    elapsedSec: Math.floor((snapshot?.elapsedMs ?? 0) / 1000), distanceKm: snapshot?.distanceKm ?? 0, speedKmh: snapshot?.speedKmh ?? 0,
    calories: estimateCalories(snapshot?.distanceKm ?? 0, context.weightKg),
    gpsStatus: (snapshot?.gpsStatus ?? fallbackStatus) as GpsStatus, error, busy, begin,
    pause: () => change('pause'), resume: () => change('resume'),
    cancel: async () => {if (!current.current) return true; return (await change('clear')) === null && current.current === null;},
    finish: async () => {const final = await change('finish'); return final ? sessionResult(final) : null;},
  };
}
