import { getApp } from '@react-native-firebase/app';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import { documentId, type FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { auth, firestore } from '../lib/firebase';

export type PublicProfile = {
  uid: string;
  display_name: string;
  profile_image: string | null;
  total_km: number;
  region: string;
  follower_count: number;
  following_count: number;
  influencer_tier: string;
};
export type SocialPost = {
  post_id: string;
  uid: string;
  author_name: string;
  author_image: string | null;
  author_tier: string;
  text: string;
  image_url: string | null;
  visibility: 'public' | 'followers' | 'private';
  run_id: string | null;
  distance_km: number | null;
  avg_pace_sec: number | null;
  calories: number | null;
  hashtags: string[];
  like_count: number;
  comment_count: number;
  createdAtMs: number;
  deleted?: boolean;
};
export type SocialComment = {
  comment_id: string;
  uid: string;
  author_name: string;
  author_image: string | null;
  text: string;
  parent_id: string | null;
  deleted: boolean;
  createdAtMs: number;
};
export type FeedScope = 'public' | 'following' | 'mine';
export type PostCursor = FirebaseFirestoreTypes.QueryDocumentSnapshot;

export function myUid() {
  const uid = auth().currentUser?.uid;
  if (!uid) throw new Error('로그인이 필요해요.');
  return uid;
}
export async function socialRequest<T>(
  action: string,
  input: Record<string, unknown> = {},
): Promise<T> {
  myUid();
  const response = await httpsCallable<Record<string, unknown>, T>(
    getFunctions(getApp(), 'asia-northeast3'),
    'socialAction',
  )({ action, ...input });
  return response.data;
}
export function newSocialId() {
  return firestore().collection('posts').doc().id;
}
export function decodePost(
  doc: FirebaseFirestoreTypes.DocumentSnapshot,
): SocialPost {
  const data = doc.data()!;
  return {
    ...data,
    post_id: doc.id,
    createdAtMs: data.created_at?.toMillis?.() ?? 0,
  } as SocialPost;
}
function postsQuery(scope: Exclude<FeedScope, 'following'>) {
  const base = firestore().collection('posts');
  return (
    scope === 'mine'
      ? base.where('uid', '==', myUid())
      : base.where('visibility', '==', 'public')
  )
    .orderBy('created_at', 'desc')
    .orderBy(documentId(), 'desc');
}
export function watchFeed(
  scope: Exclude<FeedScope, 'following'>,
  next: (posts: SocialPost[], last: PostCursor | null, more: boolean) => void,
  error: (error: Error) => void,
) {
  return postsQuery(scope)
    .limit(20)
    .onSnapshot(
      snap =>
        next(
          snap.docs.map(decodePost).filter(p => !p.deleted),
          snap.docs.at(-1) ?? null,
          snap.size === 20,
        ),
      error,
    );
}
export async function earlierPosts(
  scope: Exclude<FeedScope, 'following'>,
  cursor: PostCursor,
) {
  const snapshot = await postsQuery(scope).startAfter(cursor).limit(20).get();
  return {
    posts: snapshot.docs.map(decodePost).filter(p => !p.deleted),
    last: snapshot.docs.at(-1) ?? null,
    more: snapshot.size === 20,
  };
}
export function watchPost(
  id: string,
  next: (post: SocialPost | null) => void,
  error: (error: Error) => void,
) {
  return firestore()
    .collection('posts')
    .doc(id)
    .onSnapshot(
      snap =>
        next(snap.exists() && !snap.get('deleted') ? decodePost(snap) : null),
      error,
    );
}
export function watchPostFlags(
  id: string,
  next: (flags: { liked?: boolean; saved?: boolean }) => void,
) {
  const uid = myUid();
  const a = firestore()
    .collection('posts')
    .doc(id)
    .collection('likes')
    .doc(uid)
    .onSnapshot(
      s => next({ liked: s.exists() }),
      () => next({ liked: false }),
    );
  const b = firestore()
    .collection('bookmarks')
    .doc(`${uid}_${id}`)
    .onSnapshot(
      s => next({ saved: s.exists() }),
      () => next({ saved: false }),
    );
  return () => {
    a();
    b();
  };
}
export function watchComments(
  id: string,
  next: (
    comments: SocialComment[],
    cursor: PostCursor | null,
    more: boolean,
  ) => void,
  error: (error: Error) => void,
) {
  return firestore()
    .collection('posts')
    .doc(id)
    .collection('comments')
    .orderBy('created_at', 'desc')
    .limit(50)
    .onSnapshot(
      snap =>
        next(
          snap.docs
            .map(
              doc =>
                ({
                  ...doc.data(),
                  comment_id: doc.id,
                  createdAtMs:
                    (
                      doc.get('created_at') as
                        | { toMillis?: () => number }
                        | undefined
                    )?.toMillis?.() ?? 0,
                } as SocialComment),
            )
            .reverse(),
          snap.docs.at(-1) ?? null,
          snap.size === 50,
        ),
      error,
    );
}
export async function earlierComments(id: string, cursor: PostCursor) {
  const snap = await firestore()
    .collection('posts')
    .doc(id)
    .collection('comments')
    .orderBy('created_at', 'desc')
    .startAfter(cursor)
    .limit(50)
    .get();
  return {
    comments: snap.docs.map(
      doc =>
        ({
          ...doc.data(),
          comment_id: doc.id,
          createdAtMs:
            (
              doc.get('created_at') as { toMillis?: () => number } | undefined
            )?.toMillis?.() ?? 0,
        } as SocialComment),
    ),
    cursor: snap.docs.at(-1) ?? null,
    more: snap.size === 50,
  };
}
export async function savedPosts() {
  const snapshot = await firestore()
    .collection('bookmarks')
    .where('uid', '==', myUid())
    .orderBy('created_at', 'desc')
    .limit(50)
    .get();
  const results = await Promise.all(
    snapshot.docs.map(async doc => {
      try {
        return (
          await socialRequest<{ post: SocialPost }>('post', {
            postId: doc.get('post_id'),
          })
        ).post;
      } catch {
        return null;
      }
    }),
  );
  return results.filter((post): post is SocialPost => post !== null);
}
export function socialError(error: unknown) {
  if (error instanceof Error)
    return error.message.replace(/^\[functions\/[^\]]+\]\s*/, '');
  return '처리하지 못했어요. 다시 시도해 주세요.';
}
