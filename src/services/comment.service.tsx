import firestore from '@react-native-firebase/firestore';
import {auth, firestore as db} from '../lib/firebase';

export type Comment = {
  comment_id: string;
  post_id: string;
  uid: string;
  author_name: string;
  text: string;
  reply_count: number;
  created_at: any;
};

export type Reply = {
  reply_id: string;
  comment_id: string;
  uid: string;
  author_name: string;
  text: string;
  created_at: any;
};

export function subscribeComments(postId: string, onChange: (comments: Comment[]) => void) {
  return db()
    .collection('posts')
    .doc(postId)
    .collection('comments')
    .onSnapshot(
      snap => {
        const sorted = snap.docs
          .map(d => d.data() as Comment)
          .sort((a, b) => {
            const at = a.created_at?.toDate?.()?.getTime?.() ?? 0;
            const bt = b.created_at?.toDate?.()?.getTime?.() ?? 0;
            return at - bt;
          });
        onChange(sorted);
      },
      () => onChange([]),
    );
}

export function subscribeReplies(
  postId: string,
  commentId: string,
  onChange: (replies: Reply[]) => void,
) {
  return db()
    .collection('posts')
    .doc(postId)
    .collection('comments')
    .doc(commentId)
    .collection('replies')
    .onSnapshot(
      snap => {
        const sorted = snap.docs
          .map(d => d.data() as Reply)
          .sort((a, b) => {
            const at = a.created_at?.toDate?.()?.getTime?.() ?? 0;
            const bt = b.created_at?.toDate?.()?.getTime?.() ?? 0;
            return at - bt;
          });
        onChange(sorted);
      },
      () => onChange([]),
    );
}

export async function addComment(
  postId: string,
  text: string,
  authorName: string,
): Promise<void> {
  const currentUser = auth().currentUser;
  if (!currentUser) throw new Error('로그인이 필요해요.');
  const ref = db().collection('posts').doc(postId).collection('comments').doc();
  const postRef = db().collection('posts').doc(postId);
  await Promise.all([
    ref.set({
      comment_id: ref.id,
      post_id: postId,
      uid: currentUser.uid,
      author_name: authorName,
      text: text.trim(),
      reply_count: 0,
      created_at: firestore.FieldValue.serverTimestamp(),
    } satisfies Comment),
    postRef.update({chat_count: firestore.FieldValue.increment(1)}),
  ]);
}

export async function addReply(
  postId: string,
  commentId: string,
  text: string,
  authorName: string,
): Promise<void> {
  const currentUser = auth().currentUser;
  if (!currentUser) throw new Error('로그인이 필요해요.');
  const replyRef = db()
    .collection('posts')
    .doc(postId)
    .collection('comments')
    .doc(commentId)
    .collection('replies')
    .doc();
  const commentRef = db().collection('posts').doc(postId).collection('comments').doc(commentId);
  const postRef = db().collection('posts').doc(postId);
  await Promise.all([
    replyRef.set({
      reply_id: replyRef.id,
      comment_id: commentId,
      uid: currentUser.uid,
      author_name: authorName,
      text: text.trim(),
      created_at: firestore.FieldValue.serverTimestamp(),
    } satisfies Reply),
    commentRef.update({reply_count: firestore.FieldValue.increment(1)}),
    postRef.update({chat_count: firestore.FieldValue.increment(1)}),
  ]);
}
