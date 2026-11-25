import firestore from '@react-native-firebase/firestore';
import {auth, firestore as db} from '../lib/firebase';
import type {GpsPoint, RunDocument, RunGoalType} from '../types/run.types';
import {calculateAveragePace} from '../utils/pace';

export async function saveRunRecord({
  goalType,
  goalValue,
  startedAt,
  durationSec,
  distanceKm,
  avgSpeedKmh,
  calories,
  route,
  parkId = null,
  courseId = null,
  expectedUid,
}: {
  goalType: RunGoalType;
  goalValue: number | null;
  startedAt: Date;
  durationSec: number;
  distanceKm: number;
  avgSpeedKmh: number;
  calories: number;
  route: GpsPoint[];
  parkId?: string | null;
  courseId?: string | null;
  expectedUid?: string;
}) {
  const user = auth().currentUser;

  if (!user || (expectedUid !== undefined && user.uid !== expectedUid)) {
    throw new Error('달리기 기록을 저장하려면 로그인이 필요해요.');
  }
  if (!Number.isFinite(durationSec) || !Number.isFinite(distanceKm) || distanceKm < 0 || !Number.isFinite(startedAt.getTime())) throw new Error('달리기 기록의 시간과 거리를 확인해 주세요.');
  durationSec = Math.max(1, Math.round(durationSec));

  // A timed-out write may already have committed. Reuse the session identity.
  const runRef = db().collection('runs').doc(`${user.uid}_${startedAt.getTime()}`);
  const run: RunDocument = {
    run_id: runRef.id,
    uid: user.uid,
    goal_type: goalType,
    goal_value: goalValue,
    started_at: firestore.Timestamp.fromDate(startedAt),
    ended_at: firestore.FieldValue.serverTimestamp(),
    duration_sec: durationSec,
    distance_km: distanceKm,
    avg_pace_sec: calculateAveragePace(durationSec, distanceKm),
    avg_speed_kmh: avgSpeedKmh,
    avg_heart_rate: null,
    calories,
    route,
    park_id: parkId,
    ...(courseId ? {course_id: courseId} : {}),
    exp_earned: 0,
    created_at: firestore.FieldValue.serverTimestamp(),
  };

  try {
    await runRef.set(run);
  } catch (error) {
    try {
      const existing = await runRef.get({source:'server'});
      if (existing.exists() && existing.get('uid') === user.uid) return existing.data() as RunDocument;
    } catch { /* Preserve the original save error for retry. */ }
    throw error;
  }

  return run;
}

export async function fetchRunsBetween(start: Date, end: Date) {
  const user = auth().currentUser;

  if (!user) {
    return [];
  }

  const snap = await db()
    .collection('runs')
    .where('uid', '==', user.uid)
    .where('started_at', '>=', firestore.Timestamp.fromDate(start))
    .where('started_at', '<=', firestore.Timestamp.fromDate(end))
    .orderBy('started_at', 'desc')
    .get();

  return snap.docs.map(doc => doc.data() as RunDocument);
}

export function fetchMonthlyRuns(year: number, monthIndex: number) {
  return fetchRunsBetween(new Date(year, monthIndex, 1), new Date(year, monthIndex + 1, 0, 23, 59, 59, 999));
}

// 이번 주(월요일 시작) 기록
export function fetchThisWeekRuns(now = new Date()) {
  const mondayOffset = (now.getDay() + 6) % 7;
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset);
  const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6, 23, 59, 59, 999);
  return fetchRunsBetween(weekStart, weekEnd);
}

export function getRunStartedAtDate(run: RunDocument) {
  const startedAt = run.started_at as {toDate?: () => Date};
  return startedAt?.toDate ? startedAt.toDate() : new Date();
}
