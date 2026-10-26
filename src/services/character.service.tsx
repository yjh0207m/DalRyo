import firestore from '@react-native-firebase/firestore';
import {firestore as db, storage} from '../lib/firebase';
import {CHARACTER_TYPES, type CharacterDocument, type CharacterStage, type CharacterType} from '../types/character.types';

const STORAGE_STAGE_SUFFIX: Record<Exclude<CharacterStage, 'egg'>, 'S' | 'M' | 'L'> = {
  baby: 'S',
  child: 'M',
  runner: 'L',
};

// goldpig는 특별 캐릭터라 가입 시 지급 대상에서 제외
const STARTER_TYPES = CHARACTER_TYPES.filter(type => type !== 'goldpig');

export function pickStarterCharacter(): CharacterType {
  return STARTER_TYPES[Math.floor(Math.random() * STARTER_TYPES.length)];
}

// Firebase Storage 경로. egg 단계는 로컬 egg.png를 쓰므로 null
export function getCharacterImagePath(type: CharacterType, stage: CharacterStage) {
  if (stage === 'egg') {
    return null;
  }

  return `characters/${type}/${type}_${STORAGE_STAGE_SUFFIX[stage]}.png`;
}

export async function fetchCharacterImageUrl(type: CharacterType, stage: CharacterStage) {
  const path = getCharacterImagePath(type, stage);

  if (!path) {
    return null;
  }

  return storage().ref(path).getDownloadURL();
}

export async function createInitialCharacter({
  uid,
  petName,
  characterType,
}: {
  uid: string;
  petName: string;
  characterType: CharacterType;
}) {
  const now = firestore.FieldValue.serverTimestamp();
  const character: CharacterDocument = {
    uid,
    stage: 'egg',
    character_type: characterType,
    pet_name: petName,
    exp: 0,
    stat_stamina: 0,
    stat_speed: 0,
    stat_endurance: 0,
    last_active_at: now,
    created_at: now,
    updated_at: now,
  };

  await db().collection('users').doc(uid).collection('character').doc(uid).set(character);

  return character;
}
