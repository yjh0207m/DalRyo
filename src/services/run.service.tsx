import firestore from '@react-native-firebase/firestore';
import {auth, firestore as db} from '../lib/firebase';
import type {GpsPoint, RunDocument, RunGoalType, RunSummary} from '../types/run.types';
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
}) {
  const user = auth().currentUser;

  if (!user) {
    throw new Error('달리기 기록을 저장하려면 로그인이 필요해요.');
  }

  const runRef = db().collection('runs').doc();
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
    exp_earned: 0,
    created_at: firestore.FieldValue.serverTimestamp(),
  };

  await runRef.set(run);

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

export function summarizeRuns(runs: RunDocument[]): RunSummary {
  if (runs.length === 0) {
    return {
      totalDistanceKm: 0,
      averageDistanceKm: 0,
      averageDurationSec: 0,
      averagePaceSec: 0,
      averageCalories: 0,
      averageElevationM: 0,
      averageHeartRate: 0,
    };
  }

  const sum = runs.reduce(
    (acc, run) => ({
      distance: acc.distance + run.distance_km,
      duration: acc.duration + run.duration_sec,
      pace: acc.pace + run.avg_pace_sec,
      calories: acc.calories + run.calories,
      heartRate: acc.heartRate + (run.avg_heart_rate ?? 0),
    }),
    {distance: 0, duration: 0, pace: 0, calories: 0, heartRate: 0},
  );

  return {
    totalDistanceKm: sum.distance,
    averageDistanceKm: sum.distance / runs.length,
    averageDurationSec: Math.round(sum.duration / runs.length),
    averagePaceSec: Math.round(sum.pace / runs.length),
    averageCalories: Math.round(sum.calories / runs.length),
    averageElevationM: 0,
    averageHeartRate: Math.round(sum.heartRate / runs.length),
  };
}
