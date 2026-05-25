import SunCalc from 'suncalc';

const SEOUL = {latitude: 37.5665, longitude: 126.978};
const IP_API = 'https://ipapi.co/json/';
const FETCH_TIMEOUT_MS = 4000;

const DUSK_BUFFER_MS = 90 * 60 * 1000; // 일몰 90분 전부터 저녁 배경

function calcIsDusk(latitude: number, longitude: number): boolean {
  const now = new Date();
  const {sunrise, sunset} = SunCalc.getTimes(now, latitude, longitude);
  return now.getTime() >= sunset.getTime() - DUSK_BUFFER_MS || now.getTime() < sunrise.getTime();
}

export function getIsDuskSync(): boolean {
  return calcIsDusk(SEOUL.latitude, SEOUL.longitude);
}

export async function getIsDusk(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const res = await fetch(IP_API, {signal: controller.signal});
    clearTimeout(timerId);

    const {latitude, longitude} = await res.json();
    if (typeof latitude === 'number' && typeof longitude === 'number') {
      return calcIsDusk(latitude, longitude);
    }
  } catch {
    // 타임아웃 또는 네트워크 오류 시 서울 좌표로 폴백
  }

  return calcIsDusk(SEOUL.latitude, SEOUL.longitude);
}
