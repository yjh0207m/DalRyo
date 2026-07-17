import firestore from '@react-native-firebase/firestore';
import type {FirebaseFirestoreTypes} from '@react-native-firebase/firestore';
import {auth, firestore as db, storage} from '../lib/firebase';

export type FeedPost = {
  post_id: string;
  uid: string;
  author_name: string;
  author_image: string | null;
  author_tier: string;
  run_id: string | null;
  category: 'feed';
  text: string;
  image_url: string | null;
  distance_km: number | null;
  avg_pace_sec: number | null;
  calories: number | null;
  hashtags: string[];
  like_count: number;
  comment_count: number;
  chat_count: number;
  visibility: 'public' | 'followers' | 'private';
  dialect: string;
  created_at: FirebaseFirestoreTypes.FieldValue;
};

export function subscribePublicPosts(onChange: (posts: FeedPost[]) => void) {
  return db()
    .collection('posts')
    .where('visibility', '==', 'public')
    .limit(30)
    .onSnapshot(
      snap => {
        const sorted = snap.docs
          .map(doc => doc.data() as FeedPost)
          .sort((a, b) => {
            const at = (a.created_at as any)?.toDate?.()?.getTime?.() ?? 0;
            const bt = (b.created_at as any)?.toDate?.()?.getTime?.() ?? 0;
            return bt - at;
          });
        onChange(sorted);
      },
      () => onChange([]),
    );
}

export function subscribeMyPosts(onChange: (posts: FeedPost[]) => void) {
  const currentUser = auth().currentUser;
  if (!currentUser) { onChange([]); return () => undefined; }

  return db()
    .collection('posts')
    .where('uid', '==', currentUser.uid)
    .limit(30)
    .onSnapshot(
      snap => {
        const sorted = snap.docs
          .map(doc => doc.data() as FeedPost)
          .sort((a, b) => {
            const at = (a.created_at as any)?.toDate?.()?.getTime?.() ?? 0;
            const bt = (b.created_at as any)?.toDate?.()?.getTime?.() ?? 0;
            return bt - at;
          });
        onChange(sorted);
      },
      () => onChange([]),
    );
}

export function subscribeUserPosts(uid: string, onChange: (posts: FeedPost[]) => void) {
  return db()
    .collection('posts')
    .where('uid', '==', uid)
    .where('visibility', '==', 'public')
    .limit(30)
    .onSnapshot(
      snap => {
        const sorted = snap.docs
          .map(doc => doc.data() as FeedPost)
          .sort((a, b) => {
            const at = (a.created_at as any)?.toDate?.()?.getTime?.() ?? 0;
            const bt = (b.created_at as any)?.toDate?.()?.getTime?.() ?? 0;
            return bt - at;
          });
        onChange(sorted);
      },
      () => onChange([]),
    );
}

export function subscribeMyFeed(onChange: (posts: FeedPost[]) => void) {
  const currentUser = auth().currentUser;

  if (!currentUser) {
    onChange([]);
    return () => undefined;
  }

  return db()
    .collection('users')
    .doc(currentUser.uid)
    .collection('feed')
    .orderBy('created_at', 'desc')
    .limit(20)
    .onSnapshot(
      snap => { onChange(snap.docs.map(doc => doc.data() as FeedPost)); },
      () => onChange([]),
    );
}

async function uploadPostImage(userId: string, postId: string, localUri: string): Promise<string> {
  const ref = storage().ref(`posts/${userId}/${postId}.jpg`);
  await ref.putFile(localUri);
  return ref.getDownloadURL();
}

export async function getPostInteractions(postId: string): Promise<{liked: boolean; joined: boolean; saved: boolean}> {
  const currentUser = auth().currentUser;
  if (!currentUser) return {liked: false, joined: false, saved: false};
  const uid = currentUser.uid;
  const [likeSnap, joinSnap, saveSnap] = await Promise.all([
    db().collection('users').doc(uid).collection('liked_posts').doc(postId).get(),
    db().collection('users').doc(uid).collection('joined_posts').doc(postId).get(),
    db().collection('users').doc(uid).collection('saved_posts').doc(postId).get(),
  ]);
  return {liked: likeSnap.exists(), joined: joinSnap.exists(), saved: saveSnap.exists()};
}

export async function toggleLike(postId: string): Promise<boolean> {
  const currentUser = auth().currentUser;
  if (!currentUser) throw new Error('로그인이 필요해요.');
  const likeRef = db().collection('users').doc(currentUser.uid).collection('liked_posts').doc(postId);
  const postRef = db().collection('posts').doc(postId);
  const snap = await likeRef.get();
  if (snap.exists()) {
    await Promise.all([likeRef.delete(), postRef.update({like_count: firestore.FieldValue.increment(-1)})]);
    return false;
  } else {
    await Promise.all([likeRef.set({liked_at: firestore.FieldValue.serverTimestamp()}), postRef.update({like_count: firestore.FieldValue.increment(1)})]);
    return true;
  }
}

export async function toggleJoin(postId: string): Promise<boolean> {
  const currentUser = auth().currentUser;
  if (!currentUser) throw new Error('로그인이 필요해요.');
  const joinRef = db().collection('users').doc(currentUser.uid).collection('joined_posts').doc(postId);
  const postRef = db().collection('posts').doc(postId);
  const snap = await joinRef.get();
  if (snap.exists()) {
    await Promise.all([joinRef.delete(), postRef.update({comment_count: firestore.FieldValue.increment(-1)})]);
    return false;
  } else {
    await Promise.all([joinRef.set({joined_at: firestore.FieldValue.serverTimestamp()}), postRef.update({comment_count: firestore.FieldValue.increment(1)})]);
    return true;
  }
}

export async function toggleSave(postId: string): Promise<boolean> {
  const currentUser = auth().currentUser;
  if (!currentUser) throw new Error('로그인이 필요해요.');
  const saveRef = db().collection('users').doc(currentUser.uid).collection('saved_posts').doc(postId);
  const snap = await saveRef.get();
  if (snap.exists()) {
    await saveRef.delete();
    return false;
  } else {
    await saveRef.set({saved_at: firestore.FieldValue.serverTimestamp()});
    return true;
  }
}

export async function createFeedPost(input: {
  text: string;
  authorName: string;
  authorImage?: string | null;
  imageUri?: string | null;
  visibility?: 'public' | 'followers' | 'private';
  runId?: string | null;
  distanceKm?: number | null;
  avgPaceSec?: number | null;
  calories?: number | null;
  dialect?: string;
}) {
  const currentUser = auth().currentUser;

  if (!currentUser) {
    throw new Error('로그인이 필요해요.');
  }

  const postRef = db().collection('posts').doc();

  let imageUrl: string | null = null;
  if (input.imageUri) {
    imageUrl = await uploadPostImage(currentUser.uid, postRef.id, input.imageUri);
  }

  const post: FeedPost = {
    post_id: postRef.id,
    uid: currentUser.uid,
    author_name: input.authorName,
    author_image: input.authorImage ?? null,
    author_tier: 'none',
    run_id: input.runId ?? null,
    category: 'feed',
    text: input.text,
    image_url: imageUrl,
    distance_km: input.distanceKm ?? null,
    avg_pace_sec: input.avgPaceSec ?? null,
    calories: input.calories ?? null,
    hashtags: ['오운완', '달료런'],
    like_count: 0,
    comment_count: 0,
    chat_count: 0,
    visibility: input.visibility ?? 'public',
    dialect: input.dialect ?? 'std',
    created_at: firestore.FieldValue.serverTimestamp(),
  };

  await postRef.set(post);

  return post;
}
