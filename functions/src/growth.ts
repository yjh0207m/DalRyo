// 캐릭터 성장 규칙. 앱의 src/utils/exp.tsx와 같은 규칙이어야 한다 (앱은 미리보기용, 서버가 최종 반영)

export type CharacterStage = 'egg' | 'baby' | 'child' | 'runner';

const STAGE_ORDER: CharacterStage[] = ['egg', 'baby', 'child', 'runner'];

export const STAT_MAX = 100;

export function calculateRunExp(distanceKm: number, streakBonus = 1, itemMultiplier = 1) {
  return Math.floor(distanceKm * 10 * streakBonus * itemMultiplier);
}

export function getCharacterStage(totalKm: number): CharacterStage {
  if (totalKm >= 200) return 'runner';
  if (totalKm >= 50) return 'child';
  if (totalKm > 0) return 'baby';
  return 'egg';
}

// 단계는 되돌아가지 않는다
export function laterStage(a: CharacterStage, b: CharacterStage): CharacterStage {
  return STAGE_ORDER.indexOf(a) >= STAGE_ORDER.indexOf(b) ? a : b;
}

export function calculateStatGains({distanceKm, avgSpeedKmh, durationSec}: {distanceKm: number; avgSpeedKmh: number; durationSec: number}) {
  return {
    stamina: Math.floor(distanceKm * 0.5),
    speed: Math.floor(avgSpeedKmh * 0.3),
    endurance: Math.floor((durationSec / 60) * 0.2),
  };
}

export function addStat(current: unknown, gain: number) {
  const base = typeof current === 'number' ? current : 0;
  return Math.min(STAT_MAX, base + gain);
}
