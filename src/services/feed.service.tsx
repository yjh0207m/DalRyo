import firestore from '@react-native-firebase/firestore';
import type {FirebaseFirestoreTypes} from '@react-native-firebase/firestore';
import {auth, firestore as db} from '../lib/firebase';

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
  visibility: 'public' | 'followers' | 'private';
  dialect: string;
  created_at: FirebaseFirestoreTypes.FieldValue;
};

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
    .onSnapshot(snap => {
      onChange(snap.docs.map(doc => doc.data() as FeedPost));
    });
}

export async function createFeedPost(input: {
  text: string;
  authorName: string;
  authorImage?: string | null;
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
  const post: FeedPost = {
    post_id: postRef.id,
    uid: currentUser.uid,
    author_name: input.authorName,
    author_image: input.authorImage ?? null,
    author_tier: 'none',
    run_id: input.runId ?? null,
    category: 'feed',
    text: input.text,
    image_url: null,
    distance_km: input.distanceKm ?? null,
    avg_pace_sec: input.avgPaceSec ?? null,
    calories: input.calories ?? null,
    hashtags: ['오운완', '달료런'],
    like_count: 0,
    comment_count: 0,
    visibility: 'public',
    dialect: input.dialect ?? 'std',
    created_at: firestore.FieldValue.serverTimestamp(),
  };

  await postRef.set(post);

  return post;
}
