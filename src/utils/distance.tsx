const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

// 두 좌표 사이 거리(km), 하버사인 공식
export function calcDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

// 달리기 칼로리 근사치: 체중(kg) × 거리(km) × 1.036
export function estimateCalories(distanceKm: number, weightKg: number | null) {
  return Math.round((weightKg ?? 60) * distanceKm * 1.036);
}
