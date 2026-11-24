import type { RunDocument } from '../types/run.types';
import { regionFromAddressDetail } from '../utils/regions';

const ENDPOINT = 'https://nominatim.openstreetmap.org/reverse';
const TIMEOUT_MS = 8000;

// 특별시·광역시는 구·군까지, 도는 시·군까지만 쓴다(예: 서울 강남구, 경기 수원시).
// 동·리·도로명이나 도 아래 시의 구 같은 더 세부적인 단위는 일부러 쓰지 않는다
export function districtLabel(address: unknown): string | null {
  return regionFromAddressDetail(address);
}

// 달리기 출발 지점이 어느 시·구(광역시)·시·군(도)인지 알아낸다. 알 수 없으면 null
export async function fetchRunDistrict(
  run: RunDocument,
): Promise<string | null> {
  const start = run.route?.find(
    point => Number.isFinite(point.lat) && Number.isFinite(point.lng),
  );
  if (!start) return null;
  // 정확한 출발 지점이 밖으로 나가지 않도록 약 1km 단위로 뭉갠 좌표만 보낸다
  const lat = start.lat.toFixed(2);
  const lng = start.lng.toFixed(2);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    // zoom=12는 구·군 단위까지 돌려준다
    const response = await fetch(
      `${ENDPOINT}?format=jsonv2&lat=${lat}&lon=${lng}&zoom=12&addressdetails=1&accept-language=ko`,
      {
        headers: {
          'User-Agent': 'DalRyo/1.0 (+https://github.com/yjh0207m/DalRyo)',
          Accept: 'application/json',
        },
        signal: controller.signal,
      },
    );
    if (!response.ok) return null;
    const data = await response.json();
    return districtLabel(data?.address);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
