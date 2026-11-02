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
    let userId: string | null;
    try {
      const { user_id, ...rest } = validateAccount(request.data ?? {});
      changes = rest;
      userId = user_id;
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
      const newHandleRef = userId ? db.collection('handles').doc(userId) : null;
      const [user, character, newHandle] = await Promise.all([
        tx.get(userRef),
        tx.get(characterRef),
        newHandleRef ? tx.get(newHandleRef) : null,
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
      // 아이디가 바뀌면 새 아이디를 차지하고 이전 아이디는 놓아 준다. 이미 다른 사람 것이면 저장하지 않는다
      const currentId = user.get('user_id');
      const idChange: Record<string, unknown> = {};
      if (userId && userId !== currentId) {
        if (newHandle?.exists && newHandle.get('uid') !== request.auth!.uid)
          throw new HttpsError(
            'already-exists',
            '이미 사용 중인 아이디예요. 다른 아이디를 입력해 주세요.',
          );
        tx.set(newHandleRef!, {
          uid: request.auth!.uid,
          created_at: FieldValue.serverTimestamp(),
        });
        if (typeof currentId === 'string' && currentId)
          tx.delete(db.collection('handles').doc(currentId));
        idChange.user_id = userId;
      }
      tx.update(userRef, {
        ...changes,
        ...idChange,
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
