import {
  CHARACTER_STAGE_ORDER,
  type CharacterStage,
} from '../types/character.types';
import type { RunDocument } from '../types/run.types';
import { getCharacterStage } from './exp';

// Capture once when a session starts, before realtime profile updates arrive.
export type RunStartSnapshot = {
  stageBefore: CharacterStage;
  totalKmBefore: number;
  wasFrozen: boolean;
};

export function runCompletion(before: RunStartSnapshot, run: RunDocument) {
  // Match onRunCreate: impossible average speeds do not award growth.
  const growthDistanceKm =
    run.flagged || run.avg_speed_kmh > 25 ? 0 : run.distance_km;
  const calculated = getCharacterStage(before.totalKmBefore + growthDistanceKm);
  const stageAfter =
    CHARACTER_STAGE_ORDER.indexOf(calculated) >
    CHARACTER_STAGE_ORDER.indexOf(before.stageBefore)
      ? calculated
      : before.stageBefore;
  return { ...before, stageAfter, growthDistanceKm };
}
