import {messaging} from '../lib/firebase';

export async function getFCMToken() {
  try {
    await messaging().requestPermission();
    return await messaging().getToken();
  } catch {
    return null;
  }
}
