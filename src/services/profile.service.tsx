import {auth, firestore as db} from '../lib/firebase';
import type {CharacterDocument} from '../types/character.types';
import type {UserDocument} from '../types/user.types';
import {normalizeCharacterStage} from '../utils/exp';
import {validateProfile, type ProfileForm} from '../utils/profile';
import firestore from '@react-native-firebase/firestore';

export async function updateMyProfile(form: ProfileForm) {
  const currentUser = auth().currentUser;
  if (!currentUser) throw new Error('로그인이 필요해요. 다시 로그인해 주세요.');
  const changes = validateProfile(form);
  await db().collection('users').doc(currentUser.uid).update({
    ...changes,
    updated_at: firestore.FieldValue.serverTimestamp(),
  });
}

export type UserProfileBundle = {
  user: UserDocument;
  character: CharacterDocument | null;
};

function toBundle(user: UserDocument, character: CharacterDocument | null): UserProfileBundle {
  return {
    user,
    character: character ? {...character, stage: normalizeCharacterStage(character.stage, user.total_km)} : null,
  };
}

export async function fetchMyProfile(): Promise<UserProfileBundle | null> {
  const currentUser = auth().currentUser;

  if (!currentUser) {
    return null;
  }

  const [userSnap, characterSnap] = await Promise.all([
    db().collection('users').doc(currentUser.uid).get(),
    db().collection('users').doc(currentUser.uid).collection('character').doc(currentUser.uid).get(),
  ]);

  if (!userSnap.exists()) {
    return null;
  }

  return toBundle(
    userSnap.data() as UserDocument,
    characterSnap.exists() ? (characterSnap.data() as CharacterDocument) : null,
  );
}

export function subscribeMyProfile(onChange: (profile: UserProfileBundle | null) => void) {
  const currentUser = auth().currentUser;

  if (!currentUser) {
    onChange(null);
    return () => undefined;
  }

  let latestUser: UserDocument | null = null;
  let latestCharacter: CharacterDocument | null = null;

  const emit = () => {
    onChange(latestUser ? toBundle(latestUser, latestCharacter) : null);
  };

  const userUnsubscribe = db()
    .collection('users')
    .doc(currentUser.uid)
    .onSnapshot(snap => {
      latestUser = snap.exists() ? (snap.data() as UserDocument) : null;
      emit();
    });

  const characterUnsubscribe = db()
    .collection('users')
    .doc(currentUser.uid)
    .collection('character')
    .doc(currentUser.uid)
    .onSnapshot(snap => {
      latestCharacter = snap.exists() ? (snap.data() as CharacterDocument) : null;
      emit();
    });

  return () => {
    userUnsubscribe();
    characterUnsubscribe();
  };
}
