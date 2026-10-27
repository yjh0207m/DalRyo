import type {CharacterStage} from '../types/character.types';

// 달리기 완료 화면에서 어떤 등장 연출을 보여 줄지. 같은 달리기에서 여러 조건이 겹치면 위에 있는 것이 우선
//   hatch: 알 상태에서 처음 달림 / thaw: 돌 상태에서 달림 / grow: 단계가 올라감 / complete: 그 외
export type RevealMode = 'complete' | 'hatch' | 'grow' | 'thaw';

export function getRevealMode(before: CharacterStage, after: CharacterStage, distanceKm: number, wasFrozen: boolean): RevealMode {
  if (before === 'egg' && distanceKm > 0) return 'hatch';
  if (wasFrozen) return 'thaw';
  if (after !== before) return 'grow';
  return 'complete';
}
