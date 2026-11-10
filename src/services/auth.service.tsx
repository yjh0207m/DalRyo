import {Platform, Settings} from 'react-native';
import {auth, firestore, messaging} from '../lib/firebase';
import type {AuthResult, PhoneConfirmation} from '../types/auth.types';

function normalizeKoreanPhoneNumber(phoneNumber: string) {
  const digits = phoneNumber.replace(/[^\d]/g, '');

  if (digits.startsWith('82')) {
    return `+${digits}`;
  }

  if (digits.startsWith('0')) {
    return `+82${digits.slice(1)}`;
  }

  return `+82${digits}`;
}

export async function requestPhoneVerification(phoneNumber: string): Promise<PhoneConfirmation> {
  if (Platform.OS === 'ios') {
    const config = Settings.get('DalRyoPhoneAuthConfig');
    if (config?.bundleMatchesFirebase === false) {
      throw new Error('설치된 앱의 식별자가 Firebase 등록 정보와 달라요. 앱 식별자를 변경하지 않은 파일로 다시 설치해 주세요. (ios-bundle-mismatch)');
    }
    if (config?.callbackSchemeRegistered === false) {
      throw new Error('웹 인증 후 앱으로 돌아오는 설정이 누락됐어요. 최신 iOS 빌드로 다시 설치해 주세요. (ios-auth-callback-missing)');
    }
  }
  const normalizedPhoneNumber = normalizeKoreanPhoneNumber(phoneNumber);
  return auth().signInWithPhoneNumber(normalizedPhoneNumber);
}

export async function verifyPhoneCode(confirmation: PhoneConfirmation, code: string): Promise<AuthResult> {
  const credential = await confirmation.confirm(code);
  const user = credential?.user ?? auth().currentUser;

  if (!user) {
    throw new Error('인증된 사용자 정보를 찾을 수 없어요.');
  }

  return {
    uid: user.uid,
    phoneNumber: user.phoneNumber,
    isNewUser: credential?.additionalUserInfo?.isNewUser ?? false,
  };
}

export async function signInWithGoogle() {
  throw new Error('Google 로그인은 네이티브 SDK 연결 후 활성화할 예정이에요.');
}

export async function signInWithKakao() {
  throw new Error('KakaoTalk 로그인은 카카오 SDK와 custom token 서버 연결 후 활성화할 예정이에요.');
}

export async function signOut() {
  const uid = auth().currentUser?.uid;
  if (uid) {
    // Unlink this device before the next account can sign in.
    await firestore().collection('users').doc(uid).update({fcm_token: null});
    await messaging().deleteToken().catch(() => undefined);
  }
  await auth().signOut();
}
