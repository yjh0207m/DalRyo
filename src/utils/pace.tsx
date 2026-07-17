export function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function formatPace(paceSeconds: number) {
  const minutes = Math.floor(paceSeconds / 60);
  const seconds = paceSeconds % 60;
  return `${minutes}'${String(seconds).padStart(2, '0')}"`;
}

export function calculateAveragePace(durationSec: number, distanceKm: number) {
  if (distanceKm <= 0) {
    return 0;
  }

  return Math.round(durationSec / distanceKm);
}
