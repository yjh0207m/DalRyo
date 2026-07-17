import type {FirebaseFirestoreTypes} from '@react-native-firebase/firestore';

export type RunGoalType = 'free' | 'time' | 'distance' | 'calorie';

export type GpsPoint = {
  lat: number;
  lng: number;
  timestamp: number;
};

export type RunDocument = {
  run_id: string;
  uid: string;
  goal_type: RunGoalType;
  goal_value: number | null;
  started_at: FirebaseFirestoreTypes.Timestamp | FirebaseFirestoreTypes.FieldValue;
  ended_at: FirebaseFirestoreTypes.Timestamp | FirebaseFirestoreTypes.FieldValue | null;
  duration_sec: number;
  distance_km: number;
  avg_pace_sec: number;
  avg_speed_kmh: number;
  avg_heart_rate: number | null;
  calories: number;
  route: GpsPoint[];
  park_id: string | null;
  exp_earned: number;
  created_at: FirebaseFirestoreTypes.Timestamp | FirebaseFirestoreTypes.FieldValue;
};

export type RunSummary = {
  totalDistanceKm: number;
  averageDistanceKm: number;
  averageDurationSec: number;
  averagePaceSec: number;
  averageCalories: number;
  averageElevationM: number;
  averageHeartRate: number;
};
