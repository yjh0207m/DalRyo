import type {GpsPoint, RunDocument} from '../types/run.types';

export function buildCalendarCells(year: number, month: number): Array<number | null> {
  const leading: Array<number | null> = Array(new Date(year, month, 1).getDay()).fill(null);
  return leading.concat(Array.from({length: new Date(year, month + 1, 0).getDate()}, (_, index) => index + 1));
}

export function summarizeRunPeriod(runs: RunDocument[]) {
  const totals = runs.reduce(
    (sum, run) => ({
      distanceKm: sum.distanceKm + run.distance_km,
      durationSec: sum.durationSec + run.duration_sec,
      calories: sum.calories + run.calories,
    }),
    {distanceKm: 0, durationSec: 0, calories: 0},
  );
  return {...totals, paceSec: totals.distanceKm > 0 ? Math.round(totals.durationSec / totals.distanceKm) : 0};
}

// 위도에 따른 동서 거리 차이를 보정하고, 북쪽이 위인 경로를 여백 안에 맞춘다.
export function projectRunRoute(route: GpsPoint[] = []) {
  const valid = route.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180);
  if (valid.length < 2) return [];
  const minLat = valid.reduce((min, p) => Math.min(min, p.lat), Infinity);
  const maxLat = valid.reduce((max, p) => Math.max(max, p.lat), -Infinity);
  const minLng = valid.reduce((min, p) => Math.min(min, p.lng), Infinity);
  const maxLng = valid.reduce((max, p) => Math.max(max, p.lng), -Infinity);
  const longitudeScale = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const width = (maxLng - minLng) * longitudeScale;
  const height = maxLat - minLat;
  if (width === 0 && height === 0) return [];
  const scale = Math.min(260 / (width || 1e-10), 120 / (height || 1e-10));
  return valid.map(p => ({
    x: (300 - width * scale) / 2 + (p.lng - minLng) * longitudeScale * scale,
    y: (160 - height * scale) / 2 + (maxLat - p.lat) * scale,
  }));
}
