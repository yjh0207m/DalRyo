import {auth} from '../lib/firebase';
import {getApp} from '@react-native-firebase/app';
import {getFunctions, httpsCallable} from '@react-native-firebase/functions';
import {validateProfile, type ProfileForm} from '../utils/profile';
import type {NotificationPreferences} from '../types/user.types';

export async function saveAccount(form: ProfileForm, petName: string, profileImage: string | null, notifications: NotificationPreferences) {
  if (!auth().currentUser) throw new Error('로그인이 필요해요.');
  const profile = validateProfile(form);
  const name = petName.trim();
  if (!name || name.length > 20) throw new Error('캐릭터 이름은 1~20자로 입력해 주세요.');
  await httpsCallable(getFunctions(getApp(), 'asia-northeast3'), 'saveAccountSettings')({
    displayName: profile.display_name, petName: name, website: profile.website,
    heightCm: profile.height_cm, weightKg: profile.weight_kg, gender: profile.gender,
    region: profile.region, dialect: profile.dialect, profileImage, notifications,
  });
}
