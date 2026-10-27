import {CHARACTER_STAGE_ORDER, type CharacterStage} from '../types/character.types';

// 성장·돌 변신 규칙. functions/src/growth.ts와 같은 규칙이어야 한다 (앱은 미리보기용, 서버가 최종 반영)

export function calculateRunExp(distanceKm: number, streakBonus = 1, itemMultiplier = 1) {
  const baseExp = distanceKm * 10;
  return Math.floor(baseExp * streakBonus * itemMultiplier);
}

// 첫 달리기에서 부화(egg → baby), 이후 누적 km로 성장
export function getCharacterStage(totalKm: number): CharacterStage {
  if (totalKm >= 200) return 'runner';
  if (totalKm >= 50) return 'child';
  if (totalKm > 0) return 'baby';
  return 'egg';
}

// 예전 5단계(sprout·champion) 시절에 만들어진 캐릭터는 누적 거리로 다시 계산한다.
// 서버(onRunCreate)가 다음 달리기 때 올바른 값으로 덮어쓴다
export function normalizeCharacterStage(stage: unknown, totalKm: number): CharacterStage {
  return CHARACTER_STAGE_ORDER.includes(stage as CharacterStage) ? (stage as CharacterStage) : getCharacterStage(totalKm);
}

export const STAGE_LABELS: Record<CharacterStage, string> = {
  egg: '알',
  baby: '아기',
  child: '어린이',
  runner: '러너',
};

const NEXT_STAGE_KM: Partial<Record<CharacterStage, {next: CharacterStage; fromKm: number; toKm: number}>> = {
  baby: {next: 'child', fromKm: 0, toKm: 50},
  child: {next: 'runner', fromKm: 50, toKm: 200},
};

// 다음 단계까지 진행률. egg는 첫 달리기, runner는 최종 단계라 null
export function getNextStageProgress(stage: CharacterStage, totalKm: number) {
  const step = NEXT_STAGE_KM[stage];
  if (!step) {
    return null;
  }

  return {
    next: step.next,
    remainingKm: Math.max(0, step.toKm - totalKm),
    progress: Math.min(1, Math.max(0, (totalKm - step.fromKm) / (step.toKm - step.fromKm))),
  };
}

// 돌 변신 (F-CHAR-05): 마지막 달리기 후 3일 경고 / 5일 경고 / 7일 돌
export type StoneLevel = 'none' | 'warn3' | 'warn5' | 'stone';

export function getDaysSinceRun(lastRunAtMs: number | null, nowMs = Date.now()) {
  if (lastRunAtMs === null) {
    return null;
  }

  return Math.floor((nowMs - lastRunAtMs) / 86_400_000);
}

export function getStoneLevel(daysSinceRun: number | null): StoneLevel {
  if (daysSinceRun === null) return 'none';
  if (daysSinceRun >= 7) return 'stone';
  if (daysSinceRun >= 5) return 'warn5';
  if (daysSinceRun >= 3) return 'warn3';
  return 'none';
}
