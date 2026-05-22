import type {FirebaseFirestoreTypes} from '@react-native-firebase/firestore';

export type Gender = 'female' | 'male' | null;

export type Dialect = 'std' | 'seoul' | 'gyeonggi' | 'gangwon' | 'chung' | 'jeon' | 'gyeong' | 'jeju';

export type OnboardingProfileInput = {
  displayName: string;
  petName: string;
  birthDate: string;
  gender: Gender;
  website?: string | null;
  heightCm?: number | null;
  weightKg?: number | null;
  region: string;
  dialect: Dialect;
};

export type UserDocument = {
  uid: string;
  email: string | null;
  phone: string | null;
  display_name: string;
  pet_name: string;
  profile_image: string | null;
  website: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  gender: Gender;
  region: string;
  total_km: number;
  total_exp: number;
  last_run_at: FirebaseFirestoreTypes.Timestamp | null;
  is_frozen: boolean;
  influencer_tier: 'none' | 'nano' | 'micro' | 'macro' | 'mega';
  follower_count: number;
  following_count: number;
  dialect: Dialect;
  fcm_token: string | null;
  created_at: FirebaseFirestoreTypes.FieldValue;
  updated_at: FirebaseFirestoreTypes.FieldValue;
};
