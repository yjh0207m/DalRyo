import AsyncStorage from '@react-native-async-storage/async-storage';
import {auth, firestore} from '../lib/firebase';
import {saveRunRecord} from './run.service';
import {roomRequest} from './room.service';
import {commandRun, readActiveRun} from './runJournal.service';
import type {RunContext, RunResult} from '../types/runSession';
import {calculateAveragePace} from '../utils/pace';
import type {RunDocument} from '../types/run.types';

export type PendingRun = {id: string; context: RunContext; result: Omit<RunResult, 'startedAt'> & {startedAt: number}};
const key = (uid: string) => `@dalryo/pending-runs/v1/${uid}`;
const locks = new Map<string, Promise<unknown>>();
async function serial<T>(uid: string, action: () => Promise<T>): Promise<T> {
  const next = (locks.get(uid) ?? Promise.resolve()).catch(() => {}).then(action);
  locks.set(uid, next);
  try {return await next;} finally {if (locks.get(uid) === next) locks.delete(uid);}
}
export async function pendingRuns(uid: string): Promise<PendingRun[]> {
  const raw = await AsyncStorage.getItem(key(uid));
  if (!raw) return [];
  const runs = JSON.parse(raw) as PendingRun[];
  if (!Array.isArray(runs) || runs.some(run => run.context?.uid !== uid || run.id !== `${uid}_${run.result?.startedAt}`)) throw new Error('저장 대기 기록을 읽지 못했어요.');
  return runs;
}
export async function queueRun(context: RunContext, result: RunResult) {
  return serial(context.uid, async () => {
    const runs = await pendingRuns(context.uid);
    const id = `${context.uid}_${result.startedAt.getTime()}`;
    if (!runs.some(run => run.id === id)) {
      runs.push({id, context, result: {...result, startedAt: result.startedAt.getTime()}});
      await AsyncStorage.setItem(key(context.uid), JSON.stringify(runs));
    }
    // Keep the finished native journal until the durable outbox copy exists.
    const active = await readActiveRun(context.uid);
    if (active?.startedAtMs === result.startedAt.getTime() && active.phase === 'finished') await commandRun(active, 'clear');
    return id;
  });
}
export async function uploadPendingRun(uid: string, id: string) {
  return serial(uid, async () => {
    if (auth().currentUser?.uid !== uid) throw new Error('기록을 시작한 계정으로 로그인해 주세요.');
    const pending = (await pendingRuns(uid)).find(run => run.id === id);
    if (!pending) {
      // The automatic worker may have acknowledged this exact run first.
      if (!id.startsWith(`${uid}_`) || !/^\d+$/.test(id.slice(uid.length + 1))) throw new Error('기록 계정을 확인해 주세요.');
      const saved = await firestore().collection('runs').doc(id).get({source: 'server'});
      if (saved.exists() && saved.get('uid') === uid) return saved.data() as RunDocument;
      throw new Error('저장 대기 기록이 없어요.');
    }
    const {context, result} = pending;
    const operation = saveRunRecord({...context.goal, ...result, startedAt: new Date(result.startedAt), expectedUid: uid});
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let run;
    try {
      run = await Promise.race([operation, new Promise<never>((_, reject) => {timeout = setTimeout(() => reject(new Error('기기에 보관했어요. 연결되면 다시 저장해요.')), 8000);})]);
    } finally {if (timeout) clearTimeout(timeout);}
    if (context.roomId) {
      try {await roomRequest('finish', {roomId: context.roomId, km: result.distanceKm, pace: calculateAveragePace(result.durationSec, result.distanceKm)});}
      catch (error) {
        // A room may already be closed/left. Never resurrect it to publish progress.
        const code = String((error as {code?: string}).code);
        if (!['functions/not-found', 'functions/permission-denied', 'functions/failed-precondition'].includes(code)) throw error;
      }
    }
    // Re-read: never erase another run queued while a network request was pending.
    const remaining = (await pendingRuns(uid)).filter(entry => entry.id !== id);
    await AsyncStorage.setItem(key(uid), JSON.stringify(remaining));
    return run;
  });
}
