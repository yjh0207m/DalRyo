import firestore from '@react-native-firebase/firestore';
import {auth, firestore as db, messaging} from '../lib/firebase';

export async function getFCMToken() {
  try {
    await messaging().requestPermission();
    return await messaging().getToken();
  } catch {
    return null;
  }
}

// ─── 인앱 알림 ───────────────────────────────────────────────

export type AppNotification = {
  notif_id: string;
  type: 'like' | 'join' | 'comment' | 'reply';
  from_uid: string;
  from_name: string;
  post_id: string;
  read: boolean;
  created_at: any;
};

export function subscribeNotifications(onChange: (notifs: AppNotification[]) => void) {
  const currentUser = auth().currentUser;
  if (!currentUser) {onChange([]); return () => undefined;}
  return db()
    .collection('users')
    .doc(currentUser.uid)
    .collection('notifications')
    .onSnapshot(
      snap => {
        const sorted = snap.docs
          .map(d => d.data() as AppNotification)
          .sort((a, b) => (b.created_at?.toDate?.()?.getTime?.() ?? 0) - (a.created_at?.toDate?.()?.getTime?.() ?? 0));
        onChange(sorted);
      },
      () => onChange([]),
    );
}

export async function createNotification(
  targetUid: string,
  type: AppNotification['type'],
  fromName: string,
  postId: string,
): Promise<void> {
  const currentUser = auth().currentUser;
  if (!currentUser || currentUser.uid === targetUid) return;
  const ref = db().collection('users').doc(targetUid).collection('notifications').doc();
  await ref.set({
    notif_id: ref.id,
    type,
    from_uid: currentUser.uid,
    from_name: fromName,
    post_id: postId,
    read: false,
    created_at: firestore.FieldValue.serverTimestamp(),
  });
}

export async function markAllRead(): Promise<void> {
  const currentUser = auth().currentUser;
  if (!currentUser) return;
  const snap = await db()
    .collection('users')
    .doc(currentUser.uid)
    .collection('notifications')
    .where('read', '==', false)
    .get();
  if (snap.empty) return;
  const batch = db().batch();
  snap.docs.forEach(d => batch.update(d.ref, {read: true}));
  await batch.commit();
}
