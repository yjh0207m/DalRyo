import { getApp } from '@react-native-firebase/app';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import {
  documentId,
  type FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';
import { auth, firestore } from '../lib/firebase';
import type {
  CharacterType,
  CharacterStage,
  EquippedOutfit,
} from '../types/character.types';

export type RunnerProfile = {
  profile: PublicProfile;
  // 내가 차단한 러너
  blocked?: boolean;
  following: boolean;
  friend?: boolean;
  pet?: {
    character_type: CharacterType;
    stage: CharacterStage;
    pet_name: string;
    exp: number;
    is_frozen: boolean;
    // 이 값이 서버에 생기기 전에는 없을 수 있다
    stat_stamina?: number;
    stat_speed?: number;
    stat_endurance?: number;
    // 입고 있는 꾸미기 아이템
    equipped?: EquippedOutfit;
  } | null;
  // 러닝 기록을 비공개로 해 둔 러너는 null
  run_count?: number | null;
  runs_hidden?: boolean;
  connections_hidden?: boolean;
  // 내 프로필일 때만 온다
  privacy?: { runs_public: boolean; connections_public: boolean };
  // 내가 볼 수 있는 게시물 수
  post_count?: number;
  recent_runs?: RunSummary[];
};
export type RunSummary = {
  day: string;
  distance_km: number;
  duration_sec: number;
  avg_pace_sec: number;
  startedAtMs?: number;
};
export type BlockedUser = {
  uid: string;
  display_name: string;
  user_id?: string | null;
  profile_image: string | null;
};
// hidden: 상대가 팔로워·팔로잉 목록을 비공개로 해 둔 경우
export type ConnectionPage = {
  users: PublicProfile[];
  cursor: string | null;
  hidden?: boolean;
};

export type PublicProfile = {
  uid: string;
  display_name: string;
  // 아이디. 이 기능이 생기기 전에 가입한 사용자는 없다
  user_id?: string | null;
  profile_image: string | null;
  total_km: number;
  region: string;
  follower_count: number;
  following_count: number;
  influencer_tier: string;
  // 검색 결과에서만 온다: 내가 팔로우한 사람, 나를 팔로우한 사람, 그 외
  relation?: 'following' | 'follower' | 'none';
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
  // 답글 대상의 닉네임. 이 값이 생기기 전에 쓴 답글에는 없다
  reply_to_name?: string | null;
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
// 내가 차단한 사람 목록. 못 읽으면 빈 목록으로 둔다(차단 자체는 서버가 막는다)
export function watchBlockedUsers(next: (users: BlockedUser[]) => void) {
  return firestore()
    .collection('users')
    .doc(myUid())
    .collection('blocks')
    .orderBy('created_at', 'desc')
    .limit(500)
    .onSnapshot(
      snap => next(snap.docs.map(doc => doc.data() as BlockedUser)),
      () => next([]),
    );
}
// "보지 않음"으로 고른 게시물 id 목록
export function watchHiddenPosts(next: (ids: string[]) => void) {
  return firestore()
    .collection('users')
    .doc(myUid())
    .collection('hidden_posts')
    .limit(500)
    .onSnapshot(
      snap => next(snap.docs.map(doc => doc.id)),
      () => next([]),
    );
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
