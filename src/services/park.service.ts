import { getApp } from '@react-native-firebase/app';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import Geolocation from '@react-native-community/geolocation';
import { PermissionsAndroid, Platform } from 'react-native';
import { auth, firestore } from '../lib/firebase';
import type { ParkData } from '../../functions/src/parkData';
import type { GpsPoint } from '../types/run.types';
export type NearbyPark = ParkData & { distance_km: number };
export type ParkCourse = {
  course_id: string;
  name: string;
  distance_km: number;
  route: GpsPoint[];
};
export type ParkRunner = {
  uid: string;
  display_name: string;
  profile_image: string | null;
  distance_km: number;
  run_count: number;
};
export async function parkRequest<T>(
  action: string,
  input: Record<string, unknown> = {},
) {
  if (!auth().currentUser) throw new Error('로그인이 필요해요.');
  return (
    await httpsCallable<Record<string, unknown>, T>(
      getFunctions(getApp(), 'asia-northeast3'),
      'parkAction',
    )({ action, ...input })
  ).data;
}
export async function getCurrentParkLocation(): Promise<{
  lat: number;
  lng: number;
}> {
  if (Platform.OS === 'android') {
    const access = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
    ]);
    if (
      access[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] !==
        PermissionsAndroid.RESULTS.GRANTED &&
      access[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION] !==
        PermissionsAndroid.RESULTS.GRANTED
    )
      throw new Error('주변 공원을 찾으려면 위치 권한을 허용해 주세요.');
  } else
    await new Promise<void>((resolve, reject) =>
      Geolocation.requestAuthorization(resolve, () =>
        reject(new Error('설정에서 위치 권한을 허용해 주세요.')),
      ),
    );
  return new Promise((resolve, reject) =>
    Geolocation.getCurrentPosition(
      position =>
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }),
      () =>
        reject(
          new Error(
            '현재 위치를 찾지 못했어요. 위치 서비스를 켜고 다시 시도해 주세요.',
          ),
        ),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 },
    ),
  );
}
export async function fetchParkLabel(parkId: string, courseId?: string | null) {
  const ref = firestore().collection('parks').doc(parkId);
  const [park, course] = await Promise.all([
    ref.get(),
    courseId
      ? ref.collection('courses').doc(courseId).get()
      : Promise.resolve(null),
  ]);
  return {
    name: park.exists()
      ? String(park.get('name') ?? '공원 달리기')
      : '공원 달리기',
    course: course?.exists()
      ? String(course.get('name') ?? `${course.get('distance_km')}km 코스`)
      : null,
  };
}
