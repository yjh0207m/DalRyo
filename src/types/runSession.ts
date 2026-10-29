import type {RunGoalType, GpsPoint} from './run.types';
import type {RunStartSnapshot} from '../utils/runCompletion';
export type RunContext = {
  uid: string;
  sessionKey: string;
  goal: {goalType: RunGoalType; goalValue: number | null; parkId?: string; courseId?: string; parkName?: string};
  before: RunStartSnapshot;
  weightKg: number | null;
  roomId?: string;
};
export type RunSessionSnapshot = {
  version: 1;
  context: RunContext;
  phase: 'running' | 'paused' | 'finished';
  startedAtMs: number;
  updatedAtMs: number;
  elapsedMs: number;
  distanceKm: number;
  speedKmh: number;
  route: GpsPoint[];
  gpsStatus: 'tracking' | 'error' | 'denied';
  interrupted?: boolean;
};
export type RunResult = {startedAt: Date; durationSec: number; distanceKm: number; avgSpeedKmh: number; calories: number; route: GpsPoint[]};
