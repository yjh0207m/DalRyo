import {useCallback, useEffect, useRef, useState} from 'react';
import {PermissionsAndroid, Platform} from 'react-native';
import Geolocation, {type GeolocationResponse} from '@react-native-community/geolocation';

export type GpsStatus = 'idle' | 'requesting' | 'denied' | 'tracking' | 'error';

export type GpsFix = {
  lat: number;
  lng: number;
  accuracyM: number;
  speedMps: number | null;
  // GPS가 기록한 시각
  timestamp: number;
  // 앱이 위치를 받은 시각
  receivedAt: number;
};

// 정확도가 이보다 나쁜 위치는 버린다 (비기능 요구사항: 오차 10m 목표, 실측 여유 포함)
const MAX_ACCURACY_M = 25;

Geolocation.setRNConfiguration({
  skipPermissionRequests: false,
  authorizationLevel: 'whenInUse',
  locationProvider: 'auto',
});

async function requestLocationPermission() {
  if (Platform.OS === 'android') {
    const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
    return result === PermissionsAndroid.RESULTS.GRANTED;
  }

  return new Promise<boolean>(resolve => {
    Geolocation.requestAuthorization(
      () => resolve(true),
      () => resolve(false),
    );
  });
}

export function useGPS(onFix: (fix: GpsFix) => void) {
  const [status, setStatus] = useState<GpsStatus>('idle');
  const watchId = useRef<number | null>(null);
  const onFixRef = useRef(onFix);
  onFixRef.current = onFix;

  const stop = useCallback(() => {
    if (watchId.current !== null) {
      Geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
  }, []);

  const start = useCallback(async () => {
    stop();
    setStatus('requesting');

    const granted = await requestLocationPermission();
    if (!granted) {
      setStatus('denied');
      return false;
    }

    watchId.current = Geolocation.watchPosition(
      (position: GeolocationResponse) => {
        const {latitude, longitude, accuracy, speed} = position.coords;
        if (accuracy > MAX_ACCURACY_M) {
          return;
        }
        onFixRef.current({
          lat: latitude,
          lng: longitude,
          accuracyM: accuracy,
          speedMps: speed !== null && speed >= 0 ? speed : null,
          timestamp: position.timestamp,
          receivedAt: Date.now(),
        });
      },
      () => setStatus('error'),
      {enableHighAccuracy: true, distanceFilter: 3, interval: 1000, fastestInterval: 1000},
    );
    setStatus('tracking');
    return true;
  }, [stop]);

  useEffect(() => stop, [stop]);

  return {status, start, stop};
}
