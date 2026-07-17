import React, {useEffect, useRef, useState} from 'react';
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  addComment,
  addReply,
  subscribeComments,
  subscribeReplies,
  type Comment,
  type Reply,
} from '../../services/comment.service';
import type {UserDocument} from '../../types/user.types';

const MINT = '#58CFA6';
const MINT_DEEP = '#2BAF85';
const TEXT = '#1A1A1A';
const MUTED = '#9A9A9A';
const avatar = require('../../assets/images/dalryo-avatar.png');

type Props = {
  postId: string;
  user: UserDocument | null;
  visible: boolean;
  onClose: () => void;
};

type ReplyTarget = {commentId: string; authorName: string};

export function CommentModal({postId, user, visible, onClose}: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!visible) return;
    return subscribeComments(postId, setComments);
  }, [postId, visible]);

  const handleReplyPress = (target: ReplyTarget) => {
    setReplyTo(target);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleCancelReply = () => {
    setReplyTo(null);
    setInputText('');
  };

  const handleSend = async () => {
    const trimmed = inputText.trim();
    if (!trimmed || isSending) return;
    setIsSending(true);
    const authorName = user?.display_name ?? '달리너';
    try {
      if (replyTo) {
        await addReply(postId, replyTo.commentId, trimmed, authorName);
        setReplyTo(null);
      } else {
        await addComment(postId, trimmed, authorName);
      }
      setInputText('');
    } catch {
      // silent — user stays in input
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheet}>
          {/* 핸들 */}
          <View style={styles.handle} />

          {/* 헤더 */}
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>
              댓글 {comments.reduce((s, c) => s + 1 + c.reply_count, 0)}
            </Text>
            <TouchableOpacity activeOpacity={0.75} onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* 댓글 목록 */}
          <FlatList
            data={comments}
            keyExtractor={c => c.comment_id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyEmoji}>💬</Text>
                <Text style={styles.emptyText}>첫 댓글을 남겨보세요!</Text>
              </View>
            }
            renderItem={({item}) => (
              <CommentItem
                postId={postId}
                comment={item}
                onReply={handleReplyPress}
              />
            )}
            ItemSeparatorComponent={() => <View style={{height: 4}} />}
          />

          {/* 답글 대상 표시 */}
          {replyTo && (
            <View style={styles.replyIndicator}>
              <Text style={styles.replyIndicatorText}>
                <Text style={styles.replyIndicatorName}>@{replyTo.authorName}</Text>에게 답글
              </Text>
              <TouchableOpacity onPress={handleCancelReply}>
                <Text style={styles.replyIndicatorClose}>✕</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* 입력창 */}
          <View style={styles.inputRow}>
            <Image source={avatar} style={styles.inputAvatar} />
            <TextInput
              ref={inputRef}
              value={inputText}
              onChangeText={setInputText}
              placeholder={replyTo ? `@${replyTo.authorName}에게 답글...` : '댓글을 입력해요...'}
              placeholderTextColor="#BBBBBB"
              style={styles.input}
              multiline
              maxLength={300}
              returnKeyType="send"
              blurOnSubmit
              onSubmitEditing={handleSend}
            />
            <TouchableOpacity
              activeOpacity={0.75}
              disabled={!inputText.trim() || isSending}
              onPress={handleSend}
              style={[styles.sendBtn, (!inputText.trim() || isSending) && styles.sendBtnDisabled]}>
              <Text style={styles.sendBtnText}>전송</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────
// 댓글 아이템
// ─────────────────────────────────────────────────────────────
function CommentItem({
  postId,
  comment,
  onReply,
}: {
  postId: string;
  comment: Comment;
  onReply: (target: ReplyTarget) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [replies, setReplies] = useState<Reply[]>([]);

  useEffect(() => {
    if (comment.reply_count === 0) return;
    return subscribeReplies(postId, comment.comment_id, setReplies);
  }, [postId, comment.comment_id, comment.reply_count]);

  return (
    <View style={styles.commentWrap}>
      <Image source={avatar} style={styles.commentAvatar} />
      <View style={styles.commentBody}>
        <Text style={styles.commentAuthor}>{comment.author_name}</Text>
        <Text style={styles.commentText}>{comment.text}</Text>
        <View style={styles.commentMeta}>
          <Text style={styles.commentTime}>{relativeTime(comment.created_at)}</Text>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => onReply({commentId: comment.comment_id, authorName: comment.author_name})}>
            <Text style={styles.replyBtn}>답글 달기</Text>
          </TouchableOpacity>
          {(comment.reply_count > 0 || replies.length > 0) && (
            <TouchableOpacity activeOpacity={0.7} onPress={() => setExpanded(v => !v)}>
              <Text style={styles.replyToggle}>
                {expanded ? '답글 숨기기' : `답글 ${comment.reply_count}개 보기`}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 대댓글 */}
        {expanded && replies.map(r => <ReplyItem key={r.reply_id} reply={r} />)}
      </View>
    </View>
  );
}

function ReplyItem({reply}: {reply: Reply}) {
  return (
    <View style={styles.replyWrap}>
      <Image source={avatar} style={styles.replyAvatar} />
      <View style={styles.commentBody}>
        <Text style={styles.commentAuthor}>{reply.author_name}</Text>
        <Text style={styles.commentText}>{reply.text}</Text>
        <Text style={styles.commentTime}>{relativeTime(reply.created_at)}</Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// 유틸
// ─────────────────────────────────────────────────────────────
function relativeTime(ts: any): string {
  const date = ts?.toDate?.() ?? new Date();
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return '방금';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

// ─────────────────────────────────────────────────────────────
// 스타일
// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  overlay: {flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)'},
  backdrop: {flex: 1},
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '70%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  handle: {width: 40, height: 4, borderRadius: 2, backgroundColor: '#E0E0E0', alignSelf: 'center', marginTop: 12, marginBottom: 4},
  sheetHeader: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F0F0F0'},
  sheetTitle: {color: TEXT, fontSize: 17, fontWeight: '900'},
  closeBtn: {width: 32, height: 32, borderRadius: 16, backgroundColor: '#F4F4F4', alignItems: 'center', justifyContent: 'center'},
  closeBtnText: {color: '#555', fontSize: 13, fontWeight: '700'},

  listContent: {paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8},
  emptyWrap: {alignItems: 'center', paddingVertical: 40},
  emptyEmoji: {fontSize: 36, marginBottom: 10},
  emptyText: {color: MUTED, fontSize: 15, fontWeight: '700'},

  commentWrap: {flexDirection: 'row', gap: 10, paddingVertical: 8},
  commentAvatar: {width: 34, height: 34, borderRadius: 17, marginTop: 2},
  commentBody: {flex: 1},
  commentAuthor: {color: TEXT, fontSize: 13, fontWeight: '900', marginBottom: 3},
  commentText: {color: '#333', fontSize: 14, fontWeight: '500', lineHeight: 20},
  commentMeta: {flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 5},
  commentTime: {color: MUTED, fontSize: 12, fontWeight: '600'},
  replyBtn: {color: MUTED, fontSize: 12, fontWeight: '800'},
  replyToggle: {color: MINT_DEEP, fontSize: 12, fontWeight: '800'},

  replyWrap: {flexDirection: 'row', gap: 8, marginTop: 10, paddingLeft: 4},
  replyAvatar: {width: 26, height: 26, borderRadius: 13, marginTop: 2},

  replyIndicator: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F0FBF6', paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#E0F0E8'},
  replyIndicatorText: {color: MUTED, fontSize: 13, fontWeight: '700'},
  replyIndicatorName: {color: MINT_DEEP, fontWeight: '900'},
  replyIndicatorClose: {color: MUTED, fontSize: 14, fontWeight: '700', paddingHorizontal: 4},

  inputRow: {flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F0F0F0'},
  inputAvatar: {width: 32, height: 32, borderRadius: 16, marginBottom: 4},
  input: {flex: 1, backgroundColor: '#F5F5F5', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, color: TEXT, fontSize: 14, fontWeight: '500', maxHeight: 90},
  sendBtn: {backgroundColor: MINT, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9},
  sendBtnDisabled: {backgroundColor: '#D8D8D8'},
  sendBtnText: {color: '#FFFFFF', fontSize: 13, fontWeight: '900'},
});
