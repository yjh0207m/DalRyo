import type {FirebaseFirestoreTypes} from '@react-native-firebase/firestore';

export type CharacterType = 'penguin' | 'rabbit' | 'duck';

export type CharacterStage = 'egg' | 'sprout' | 'baby' | 'runner' | 'champion';

export type CharacterDocument = {
  uid: string;
  stage: CharacterStage;
  character_type: CharacterType;
  pet_name: string;
  exp: number;
  stat_stamina: number;
  stat_speed: number;
  stat_endurance: number;
  last_active_at: FirebaseFirestoreTypes.FieldValue;
  created_at: FirebaseFirestoreTypes.FieldValue;
  updated_at: FirebaseFirestoreTypes.FieldValue;
};
