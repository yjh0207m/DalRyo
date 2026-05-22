import firestore from '@react-native-firebase/firestore';
import {firestore as db} from '../lib/firebase';
import type {CharacterDocument, CharacterType} from '../types/character.types';

export function pickStarterCharacter(): CharacterType {
  const starters: CharacterType[] = ['penguin', 'rabbit', 'duck'];
  return starters[Math.floor(Math.random() * starters.length)];
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
    stage: 'sprout',
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
