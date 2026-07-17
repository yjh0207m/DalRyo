import {auth} from '../lib/firebase';
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
  await auth().signOut();
}
