import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getApp } from 'firebase-admin/app';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { scopedImageUrl, validateAccount } from './validation';

export const saveAccountSettings = onCall(
  { region: 'asia-northeast3', maxInstances: 5 },
  async request => {
    if (!request.auth)
      throw new HttpsError('unauthenticated', '로그인이 필요해요.');
    let changes;
    try {
      changes = validateAccount(request.data ?? {});
    } catch (error) {
      throw new HttpsError(
        'invalid-argument',
        error instanceof Error ? error.message : '입력값을 확인해 주세요.',
      );
    }
    const db = getFirestore();
    const userRef = db.collection('users').doc(request.auth.uid);
    const characterRef = userRef.collection('character').doc(request.auth.uid);
    await db.runTransaction(async tx => {
      const [user, character] = await Promise.all([
        tx.get(userRef),
        tx.get(characterRef),
      ]);
      if (!user.exists || !character.exists)
        throw new HttpsError(
          'failed-precondition',
          '프로필을 먼저 완료해 주세요.',
        );
      let profileImage: string | null;
      try {
        profileImage =
          request.data.profileImage === user.get('profile_image')
            ? user.get('profile_image')
            : scopedImageUrl(
                request.data.profileImage,
                request.auth!.uid,
                'profiles',
                getApp().options.projectId,
              );
      } catch {
        throw new HttpsError(
          'invalid-argument',
          '본인 프로필 사진만 사용할 수 있어요.',
        );
      }
      tx.update(userRef, {
        ...changes,
        profile_image: profileImage,
        updated_at: FieldValue.serverTimestamp(),
      });
      tx.update(characterRef, {
        pet_name: changes.pet_name,
        updated_at: FieldValue.serverTimestamp(),
      });
    });
    return { saved: true };
  },
);
