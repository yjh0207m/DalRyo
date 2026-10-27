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

export type StoneNotice = Exclude<StoneLevel, 'none'>;

// 스케줄러가 오늘 보낼 알림. 경고는 정확히 3일·5일째에만 (매일 반복 발송 방지),
// 7일 이상은 돌로 만들고 이후엔 is_frozen이라 다시 걸리지 않는다
export function getStoneNotice(daysSinceRun: number | null): StoneNotice | null {
  const level = getStoneLevel(daysSinceRun);
  if (level === 'stone') return 'stone';
  if (level === 'warn5' && daysSinceRun === 5) return 'warn5';
  if (level === 'warn3' && daysSinceRun === 3) return 'warn3';
  return null;
}

export function addStat(current: unknown, gain: number) {
  const base = typeof current === 'number' ? current : 0;
  return Math.min(STAT_MAX, base + gain);
}
