import type {CharacterStage} from '../types/character.types';

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
