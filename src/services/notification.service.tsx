import {auth, firestore as db, messaging} from '../lib/firebase';
import type {FirebaseFirestoreTypes} from '@react-native-firebase/firestore';
import {PermissionsAndroid, Platform} from 'react-native';

export const NOTIFICATION_PAGE_SIZE = 20;

function myNotifications() {
  const user = auth().currentUser;
  if (!user) throw new Error('알림을 확인하려면 로그인이 필요해요.');
  return db().collection('users').doc(user.uid).collection('notifications');
}

export function subscribeNotifications(onChange: (snap: FirebaseFirestoreTypes.QuerySnapshot) => void, onError: (error: Error) => void) {
  return myNotifications().orderBy('created_at', 'desc').limit(NOTIFICATION_PAGE_SIZE).onSnapshot(onChange, onError);
}

export function fetchEarlierNotifications(cursor: FirebaseFirestoreTypes.QueryDocumentSnapshot) {
  return myNotifications().orderBy('created_at', 'desc').startAfter(cursor).limit(NOTIFICATION_PAGE_SIZE).get();
}

export function subscribeUnreadNotifications(onChange: (unread: boolean) => void) {
  return myNotifications()
    .where('is_read', '==', false)
    .limit(1)
    .onSnapshot(
      snap => onChange(!snap.empty),
      () => onChange(false),
    );
}

export async function markNotificationRead(id: string) {
  if (!id || id.includes('/')) throw new Error('알림을 찾을 수 없어요.');
  await myNotifications().doc(id).update({is_read: true});
}

export async function getFCMToken() {
  try {
    await messaging().requestPermission();
    return await messaging().getToken();
  } catch {
    return null;
  }
}

export async function requestPushPermission() {
  if (Platform.OS === 'android') {
    if (Number(Platform.Version) < 33) return true;
    return await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS) === PermissionsAndroid.RESULTS.GRANTED;
  }
  const status = await messaging().requestPermission();
  return status === messaging.AuthorizationStatus.AUTHORIZED || status === messaging.AuthorizationStatus.PROVISIONAL;
}
