import type {FirebaseFirestoreTypes} from '@react-native-firebase/firestore';

// Firebase Storage characters/{type}/ 폴더 이름과 1:1 대응
export const CHARACTER_TYPES = [
  'bear', 'capybara', 'cat', 'cheetah', 'chick', 'chicken', 'cow', 'crocodile',
  'deer', 'dog', 'duck', 'eagle', 'elephant', 'fox', 'frog', 'giraffe',
  'goldpig', 'gorilla', 'hamster', 'hippo', 'horse', 'koala', 'lion', 'monkey',
  'ostrich', 'otter', 'penguin', 'pig', 'platypus', 'quokka', 'rabbit', 'raccoon',
  'sheep', 'sparrow', 'squirrel', 'tiger', 'zebra',
] as const;

export type CharacterType = (typeof CHARACTER_TYPES)[number];

// egg는 로컬 egg.png, baby/child/runner는 Storage의 {type}_S/M/L.png
export type CharacterStage = 'egg' | 'baby' | 'child' | 'runner';

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
