import {Platform} from 'react-native';
import {auth, firestore, messaging} from '../lib/firebase';
import type {AuthResult, PhoneConfirmation} from '../types/auth.types';

// 테스트 단계에서는 Firebase 콘솔에 등록한 테스트 전화번호와 인증번호로만 로그인한다.
// iOS는 인증 요청 전에 APNs 무음 푸시로 앱을 검증하고, 안 되면 reCAPTCHA 웹 화면을 띄운다(테스트 번호도 동일).
// 사이드로딩 빌드는 푸시 권한이 없어 항상 reCAPTCHA로 가므로 테스트하는 동안 앱 검증을 건너뛴다.
// 켜 두면 실제 전화번호로는 로그인할 수 없으니 실제 SMS를 테스트하거나 출시하기 전에 false로 바꾼다.
const PHONE_AUTH_TEST_NUMBERS_ONLY = true;

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
  const normalizedPhoneNumber = normalizeKoreanPhoneNumber(phoneNumber);
  if (Platform.OS === 'ios') {
    auth().settings.appVerificationDisabledForTesting = PHONE_AUTH_TEST_NUMBERS_ONLY;
  }
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
