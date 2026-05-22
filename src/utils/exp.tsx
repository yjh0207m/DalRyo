export function calculateRunExp(distanceKm: number, streakBonus = 1, itemMultiplier = 1) {
  const baseExp = distanceKm * 10;
  return Math.floor(baseExp * streakBonus * itemMultiplier);
}

export function getCharacterStage(totalKm: number) {
  if (totalKm >= 500) return 'champion';
  if (totalKm >= 200) return 'runner';
  if (totalKm >= 50) return 'baby';
  if (totalKm >= 10) return 'sprout';
  return 'egg';
}
