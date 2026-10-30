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

// 가입 선물은 두 종류만 지급한다. 나머지는 향후 상점 알 뽑기로 획득한다.
export const STARTER_CHARACTER_TYPES = ['rabbit', 'duck'] as const satisfies readonly CharacterType[];
export type StarterCharacterType = (typeof STARTER_CHARACTER_TYPES)[number];
export const SHOP_CHARACTER_TYPES = CHARACTER_TYPES.filter(
  type => !(STARTER_CHARACTER_TYPES as readonly CharacterType[]).includes(type),
);

// egg는 로컬 egg.png, baby/child/runner는 Storage의 {type}_S/M/L.png
export type CharacterStage = 'egg' | 'baby' | 'child' | 'runner';

export const CHARACTER_STAGE_ORDER: readonly CharacterStage[] = ['egg', 'baby', 'child', 'runner'];

// 속도 연동 모션 (F-CHAR-03). 'stone'은 돌 변신(users.is_frozen) 상태
export type CharacterMotion = 'idle' | 'rest' | 'slow' | 'run' | 'sprint' | 'stone';

// 꾸미기 슬롯. 그리는 순서는 CharacterView의 OUTFIT_LAYER_ORDER가 정한다
export type OutfitSlot = 'back' | 'bottom' | 'top' | 'shoes' | 'hat' | 'accessory';

// 슬롯별 장착 아이템 id (users/{uid}/inventory/{itemId}). 비어 있으면 기본 옷
export type EquippedOutfit = Partial<Record<OutfitSlot, string>>;

export type CharacterDocument = {
  uid: string;
  stage: CharacterStage;
  character_type: CharacterType;
  pet_name: string;
  equipped?: EquippedOutfit;
  exp: number;
  stat_stamina: number;
  stat_speed: number;
  stat_endurance: number;
  last_active_at: FirebaseFirestoreTypes.FieldValue;
  created_at: FirebaseFirestoreTypes.FieldValue;
  updated_at: FirebaseFirestoreTypes.FieldValue;
};
