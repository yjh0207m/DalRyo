import { auth, messaging } from '../lib/firebase';
import { forgetPendingRuns } from './runOutbox.service';
import { getApp } from '@react-native-firebase/app';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import { validateProfile, type ProfileForm } from '../utils/profile';
import type { NotificationPreferences } from '../types/user.types';

export async function saveAccount(
  form: ProfileForm,
  petName: string,
  profileImage: string | null,
  notifications: NotificationPreferences,
) {
  if (!auth().currentUser) throw new Error('로그인이 필요해요.');
  const profile = validateProfile(form);
  const name = petName.trim();
  if (!name || name.length > 20)
    throw new Error('캐릭터 이름은 1~20자로 입력해 주세요.');
  try {
    await httpsCallable(
      getFunctions(getApp(), 'asia-northeast3'),
      'saveAccountSettings',
    )({
      displayName: profile.display_name,
      userId: profile.user_id,
      petName: name,
      website: profile.website,
      heightCm: profile.height_cm,
      weightKg: profile.weight_kg,
      gender: profile.gender,
      region: profile.region,
      dialect: profile.dialect,
      profileImage,
      notifications,
    });
  } catch (failure) {
    // 다른 사람이 쓰는 아이디라는 안내는 그대로 보여 준다
    if (
      (failure as { code?: string })?.code === 'functions/already-exists' &&
      failure instanceof Error
    ) {
      throw new Error(failure.message);
    }
    throw failure;
  }
}

// 회원 탈퇴. 서버(deleteAccount)가 계정과 데이터를 모두 지운 뒤, 이 기기에 남은 것을 정리하고 로그아웃한다.
// 서버에서 사용자 문서가 이미 사라졌으므로 일반 로그아웃(알림 토큰을 사용자 문서에서 지움)은 쓰지 않는다
export async function deleteMyAccount() {
  const uid = auth().currentUser?.uid;
  if (!uid) throw new Error('로그인이 필요해요.');
  await httpsCallable(
    getFunctions(getApp(), 'asia-northeast3'),
    'deleteAccount',
  )({});
  await forgetPendingRuns(uid).catch(() => undefined);
  await messaging()
    .deleteToken()
    .catch(() => undefined);
  await auth()
    .signOut()
    .catch(() => undefined);
}
