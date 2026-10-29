import type {CharacterMotion} from '../types/character.types';

// F-CHAR-03 속도 구간: ~6 느릿느릿 / 6~11 달려달려 / 11+ 질주본능
export function getMotion(speedKmh: number, isFrozen = false): CharacterMotion {
  if (isFrozen) return 'stone';
  if (speedKmh <= 0.5) return 'rest';
  if (speedKmh < 6) return 'slow';
  if (speedKmh < 11) return 'run';
  return 'sprint';
}
