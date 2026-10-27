import { getApp } from '@react-native-firebase/app';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import { auth, firestore } from '../lib/firebase';
export type TogetherRoom = {
  room_id: string;
  title: string;
  host_uid: string;
  goal_km: number;
  capacity: number;
  member_count: number;
  status: 'waiting' | 'running' | 'finished' | 'cancelled';
  host_name?: string;
  // 아직 응답하지 않은 친구
  invited?: string[];
  invited_names?: Record<string, string>;
};
export type RoomFriend = {
  uid: string;
  display_name: string;
  profile_image: string | null;
};
export type RoomInvite = {
  room_id: string;
  title: string;
  host_uid: string;
  host_name: string;
  goal_km: number;
  member_count: number;
  capacity: number;
};
export type RoomMember = {
  uid: string;
  display_name: string;
  profile_image: string | null;
  current_km: number;
  pace_sec: number;
  state: 'active' | 'paused' | 'finished' | 'left';
  updatedAtMs: number;
};
export async function roomRequest<T>(
  action: string,
  input: Record<string, unknown> = {},
) {
  if (!auth().currentUser) throw new Error('로그인이 필요해요.');
  return (
    await httpsCallable<Record<string, unknown>, T>(
      getFunctions(getApp(), 'asia-northeast3'),
      'roomAction',
    )({ action, ...input })
  ).data;
}
export function newRoomId() {
  return firestore().collection('together_rooms').doc().id;
}
export function watchRoom(
  id: string,
  onRoom: (room: TogetherRoom | null) => void,
  onMembers: (members: RoomMember[]) => void,
  onError: (error: Error) => void,
) {
  const ref = firestore().collection('together_rooms').doc(id);
  const a = ref.onSnapshot(
    s => onRoom(s.exists() ? (s.data() as TogetherRoom) : null),
    onError,
  );
  const b = ref.collection('members').onSnapshot(
    s =>
      onMembers(
        s.docs
          .map(
            doc =>
              ({
                ...doc.data(),
                uid: doc.id,
                updatedAtMs:
                  (
                    doc.get('updated_at') as
                      | { toMillis?: () => number }
                      | undefined
                  )?.toMillis?.() ?? 0,
              } as RoomMember),
          )
          .filter(m => m.state !== 'left')
          .sort(
            (x, y) => y.current_km - x.current_km || x.uid.localeCompare(y.uid),
          ),
      ),
    onError,
  );
  return () => {
    a();
    b();
  };
}
export async function activeRoomId() {
  const uid = auth().currentUser?.uid;
  if (!uid) return null;
  const snap = await firestore()
    .collection('users')
    .doc(uid)
    .collection('room')
    .doc('active')
    .get();
  return (snap.get('room_id') as string | undefined) ?? null;
}
export async function publishRoomProgress(
  id: string,
  km: number,
  pace: number,
  state: 'active' | 'paused',
) {
  const uid = auth().currentUser?.uid;
  if (!uid) return;
  await firestore()
    .collection('together_rooms')
    .doc(id)
    .collection('members')
    .doc(uid)
    .update({
      current_km: Math.min(100, Math.max(0, km)),
      pace_sec: Math.min(86400, Math.max(0, pace)),
      state,
      updated_at: firestore.FieldValue.serverTimestamp(),
    });
}
