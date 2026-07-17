import firestore from '@react-native-firebase/firestore';
import {auth, firestore as db} from '../lib/firebase';
import type {OnboardingProfileInput, UserDocument} from '../types/user.types';
import type {CharacterType} from '../types/character.types';
import {getFCMToken} from './notification.service';
import {createInitialCharacter} from './character.service';

export async function completeOnboarding(input: OnboardingProfileInput, characterType: CharacterType) {
  const user = auth().currentUser;

  if (!user) {
    throw new Error('로그인된 사용자 정보가 없어요. 다시 로그인해 주세요.');
  }

  const now = firestore.FieldValue.serverTimestamp();
  const fcmToken = await getFCMToken();
  const userDoc: UserDocument = {
    uid: user.uid,
    email: user.email ?? null,
    phone: user.phoneNumber ?? null,
    display_name: input.displayName.trim(),
    pet_name: input.petName.trim(),
    profile_image: null,
    website: input.website?.trim() || null,
    height_cm: input.heightCm ?? null,
    weight_kg: input.weightKg ?? null,
    gender: input.gender,
    region: input.region,
    total_km: 0,
    total_exp: 0,
    last_run_at: null,
    is_frozen: false,
    influencer_tier: 'none',
    follower_count: 0,
    following_count: 0,
    dialect: input.dialect,
    fcm_token: fcmToken,
    created_at: now,
    updated_at: now,
  };

  await db().collection('users').doc(user.uid).set(userDoc, {merge: true});
  const character = await createInitialCharacter({
    uid: user.uid,
    petName: input.petName.trim(),
    characterType,
  });

  return {user: userDoc, character};
}

export async function fetchCurrentUserDocument() {
  const currentUser = auth().currentUser;

  if (!currentUser) {
    return null;
  }

  const snap = await db().collection('users').doc(currentUser.uid).get();

  if (!snap.exists()) {
    return null;
  }

  return snap.data() as UserDocument;
}
