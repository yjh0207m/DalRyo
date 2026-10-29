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

// 달리기 화면 대형 타이머용 HH:MM:SS
export function formatClock(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map(value => String(value).padStart(2, '0')).join(':');
}

export function calculateAveragePace(durationSec: number, distanceKm: number) {
  if (distanceKm <= 0) {
    return 0;
  }

  return Math.round(durationSec / distanceKm);
}
