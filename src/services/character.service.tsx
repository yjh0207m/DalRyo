import firestore from '@react-native-firebase/firestore';
import {firestore as db, storage} from '../lib/firebase';
import {STARTER_CHARACTER_TYPES, type CharacterDocument, type CharacterStage, type CharacterType, type StarterCharacterType} from '../types/character.types';

const STORAGE_STAGE_SUFFIX: Record<Exclude<CharacterStage, 'egg'>, 'S' | 'M' | 'L'> = {
  baby: 'S',
  child: 'M',
  runner: 'L',
};

export function pickStarterCharacter(): StarterCharacterType {
  return STARTER_CHARACTER_TYPES[Math.floor(Math.random() * STARTER_CHARACTER_TYPES.length)];
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

// Rive 애니메이션 파일: 동물마다 한 파일, 성장 단계는 파일 안의 아트보드(baby·child·runner)로 나눈다
export function getCharacterRivePath(type: CharacterType) {
  return `characters/${type}/${type}.riv`;
}

// 아직 Rive 파일이 없는 동물이면 null (PNG 애니메이션으로 대체)
export async function fetchCharacterRiveUrl(type: CharacterType) {
  try {
    return await storage().ref(getCharacterRivePath(type)).getDownloadURL();
  } catch (error) {
    if ((error as {code?: string})?.code === 'storage/object-not-found') {
      return null;
    }
    throw error;
  }
}

export function buildInitialCharacter({
  uid,
  petName,
  characterType,
}: {
  uid: string;
  petName: string;
  characterType: CharacterType;
}) {
  if (!(STARTER_CHARACTER_TYPES as readonly CharacterType[]).includes(characterType)) {
    throw new Error('기본 캐릭터는 토끼와 오리만 받을 수 있어요.');
  }
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

  return character;
}

export async function createInitialCharacter(input: {uid: string; petName: string; characterType: CharacterType}) {
  const character = buildInitialCharacter(input);
  await db().collection('users').doc(input.uid).collection('character').doc(input.uid).set(character);
  return character;
}
