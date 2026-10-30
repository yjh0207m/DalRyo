import Geolocation, {type GeolocationResponse} from '@react-native-community/geolocation';
import {PermissionsAndroid, Platform} from 'react-native';
import {REGIONS, regionFromAddress, type Region} from '../utils/onboarding';

let pending: Promise<Region> | null = null;
let lastResult: {lat: number; lng: number; region: Region} | null = null;
let lastRequestAt = 0;

export function detectOnboardingRegion(): Promise<Region> {
  if (pending) return pending;
  pending = detectRegion().finally(() => {pending = null;});
  return pending;
}

async function detectRegion(): Promise<Region> {
  if (Platform.OS === 'android') {
    const permissions = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
    ]);
    if (!Object.values(permissions).includes(PermissionsAndroid.RESULTS.GRANTED)) {
      throw new Error('위치 권한이 없어 지역을 찾지 못했어요. 아래에서 지역을 직접 선택해 주세요.');
    }
  } else {
    await new Promise<void>((resolve, reject) => Geolocation.requestAuthorization(resolve,
      () => reject(new Error('위치 권한을 허용하거나 아래에서 지역을 직접 선택해 주세요.'))));
  }
  const {coords} = await new Promise<GeolocationResponse>((resolve, reject) => {
    Geolocation.getCurrentPosition(resolve, () => reject(new Error('위치를 찾지 못했어요. 위치 서비스를 켜거나 지역을 직접 선택해 주세요.')),
      {enableHighAccuracy: false, timeout: 15000, maximumAge: 60000});
  });
  const {latitude: lat, longitude: lng} = coords;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new Error('위치 정보를 확인할 수 없어요. 지역을 직접 선택해 주세요.');
  }
  if (lastResult && lastResult.lat === lat && lastResult.lng === lng) return lastResult.region;
  if (Date.now() - lastRequestAt < 1500) throw new Error('잠시 후 다시 시도하거나 지역을 직접 선택해 주세요.');
  lastRequestAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat.toFixed(5)}&lon=${lng.toFixed(5)}&zoom=5&addressdetails=1&accept-language=ko`, {
      headers: {'User-Agent': 'DalRyo/1.0 (+https://github.com/yjh0207m/DalRyo)', 'Accept': 'application/json'},
      signal: controller.signal,
    });
    if (!response.ok) throw new Error('region-request-failed');
    const data = await response.json();
    const region = regionFromAddress(data.address);
    if (!region || !REGIONS.includes(region)) throw new Error('unsupported-region');
    lastResult = {lat, lng, region};
    return region;
  } catch {
    throw new Error('현재 위치의 지역을 확인하지 못했어요. 아래에서 지역을 직접 선택해 주세요.');
  } finally {
    clearTimeout(timer);
  }
}
