import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  Keyboard,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowUp, Trash2, UserRound, X } from 'lucide-react-native';
import { AppText, Button, IconButton } from '../../components/ui';
import { colors, fonts } from '../../theme';
import { useComments } from '../../hooks/useComments';
import {
  myUid,
  newSocialId,
  socialError,
  socialRequest,
  watchPost,
  type SocialComment,
  type SocialPost,
} from '../../services/social.service';

type Props = {
  postId: string;
  onClose: () => void;
  onProfile: (uid: string) => void;
};
export function CommentsSheet({ postId, onClose, onProfile }: Props) {
  const { height } = useWindowDimensions();
  const screenHeight = Dimensions.get('screen').height;
  const [modalHeight, setModalHeight] = useState(height);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  // Some Android versions resize a Modal, while edge-to-edge windows overlay it.
  // Subtract any native resize first so keyboard space is applied exactly once.
  const keyboardInset = Math.max(
    0,
    keyboardHeight - Math.max(0, screenHeight - modalHeight),
  );
  const insets = useSafeAreaInsets();
  const sheetHeight = Math.max(
    120,
    Math.min(
      screenHeight * 0.82,
      modalHeight - keyboardInset - insets.top - 16,
    ),
  );
  const sheetPaddingBottom =
    keyboardHeight > 0 ? 12 : Math.max(insets.bottom, 12);
  const [revision, setRevision] = useState(0);
  const feed = useComments(postId, revision);
  const [post, setPost] = useState<SocialPost | null>(null);
  const [postStatus, setPostStatus] = useState<'loading' | 'success' | 'error'>(
    'loading',
  );
  const [body, setBody] = useState('');
  const [reply, setReply] = useState<SocialComment | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState('');
  const input = useRef<TextInput>(null);
  const alive = useRef(true),
    sending = useRef(false),
    closing = useRef(false);
  const attempt = useRef<{
    id: string;
    text: string;
    parent: string | null;
  } | null>(null);
  const translateY = useRef(new Animated.Value(height)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidShow',
      event => {
        setKeyboardHeight(
          Math.max(
            0,
            Dimensions.get('screen').height - event.endCoordinates.screenY,
          ),
        );
      },
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  useEffect(() => {
    alive.current = true;
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        damping: 25,
        stiffness: 230,
        mass: 1,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
    return () => {
      alive.current = false;
    };
  }, [translateY, opacity]);
  const dismiss = useCallback(
    (next?: () => void) => {
      if (closing.current) return;
      closing.current = true;
      Keyboard.dismiss();
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: screenHeight,
          duration: 190,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 170,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished && alive.current) {
          onClose();
          next?.();
        }
      });
    },
    [translateY, opacity, screenHeight, onClose],
  );
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_event, g) =>
          g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_event, g) =>
          translateY.setValue(Math.max(0, g.dy)),
        onPanResponderRelease: (_event, g) => {
          if (g.dy > 75 || g.vy > 1.1) dismiss();
          else
            Animated.spring(translateY, {
              toValue: 0,
              damping: 25,
              stiffness: 230,
              useNativeDriver: true,
            }).start();
        },
        onPanResponderTerminate: () =>
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start(),
      }),
    [translateY, dismiss],
  );
  useEffect(() => {
    setPostStatus('loading');
    return watchPost(
      postId,
      value => {
        setPost(value);
        setPostStatus('success');
      },
      () => setPostStatus('error'),
    );
  }, [postId, revision]);
  useEffect(() => {
    if (
      reply &&
      feed.comments.some(c => c.comment_id === reply.comment_id && c.deleted)
    )
      setReply(null);
  }, [feed.comments, reply]);
  const available = postStatus === 'success' && !!post && !post.deleted;
  const send = async () => {
    const text = body.trim(),
      parent = reply?.comment_id ?? null;
    if (!text || sending.current || !available) return;
    sending.current = true;
    setBusy(true);
    setError('');
    const current =
      attempt.current?.text === text && attempt.current.parent === parent
        ? attempt.current
        : { id: newSocialId(), text, parent };
    attempt.current = current;
    try {
      await socialRequest('comment', {
        postId,
        commentId: current.id,
        text,
        parentId: parent,
      });
      if (alive.current) {
        setBody('');
        setReply(null);
        attempt.current = null;
      }
    } catch (e) {
      if (alive.current) setError(socialError(e));
    } finally {
      sending.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const remove = (comment: SocialComment) =>
    Alert.alert('댓글을 삭제할까요?', '답글이 있으면 삭제 표시가 남아요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          if (deleting) return;
          setDeleting(comment.comment_id);
          setError('');
          try {
            await socialRequest('deleteComment', {
              postId,
              commentId: comment.comment_id,
            });
          } catch (e) {
            if (alive.current) setError(socialError(e));
          } finally {
            if (alive.current) setDeleting(null);
          }
        },
      },
    ]);
  const retry = () => {
    setError('');
    setRevision(v => v + 1);
  };
  const profile = (uid: string) => dismiss(() => onProfile(uid));
  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => dismiss()}
    >
      <View
        style={[s.overlay, { paddingBottom: keyboardInset }]}
        onLayout={event => setModalHeight(event.nativeEvent.layout.height)}
      >
        <Animated.View style={[StyleSheet.absoluteFill, s.shade, { opacity }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityRole="button"
            accessibilityLabel="댓글 창 닫기"
            onPress={() => dismiss()}
          />
        </Animated.View>
        <Animated.View
          accessibilityViewIsModal
          onAccessibilityEscape={() => dismiss()}
          style={[
            s.sheet,
            {
              height: sheetHeight,
              paddingBottom: sheetPaddingBottom,
              transform: [{ translateY }],
            },
          ]}
        >
          <View
            {...pan.panHandlers}
            style={s.dragHandle}
            accessibilityLabel="아래로 내려 댓글 창 닫기"
          >
            <View style={s.handle} />
          </View>
          <View style={s.heading}>
            <View style={s.grow}>
              <AppText variant="heading">댓글</AppText>
              <AppText variant="label" color={colors.textMuted}>
                {post
                  ? `${post.author_name}님의 러닝 이야기`
                  : '함께 나누는 응원의 한마디'}
              </AppText>
            </View>
            <IconButton
              icon={X}
              variant="plain"
              accessibilityLabel="댓글 닫기"
              onPress={() => dismiss()}
            />
          </View>
          <ScrollView
            style={s.grow}
            contentContainerStyle={s.comments}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {postStatus === 'loading' || feed.status === 'loading' ? (
              <ActivityIndicator color={colors.primary} style={s.loading} />
            ) : postStatus === 'error' || feed.status === 'error' ? (
              <View style={s.empty}>
                <AppText align="center" color={colors.textMuted}>
                  댓글을 불러오지 못했어요.
                </AppText>
                <Button
                  label="댓글 다시 불러오기"
                  size="md"
                  variant="secondary"
                  onPress={retry}
                />
              </View>
            ) : !available ? (
              <View style={s.empty}>
                <AppText variant="subheading">게시물을 볼 수 없어요</AppText>
                <AppText color={colors.textMuted} align="center">
                  삭제됐거나 공개 범위가 변경됐을 수 있어요.
                </AppText>
              </View>
            ) : (
              <>
                {feed.more && (
                  <Button
                    size="md"
                    variant="secondary"
                    disabled={feed.pending}
                    label={
                      feed.pending
                        ? '불러오는 중…'
                        : feed.error
                        ? '이전 댓글 다시 불러오기'
                        : '이전 댓글 더 보기'
                    }
                    onPress={feed.loadMore}
                  />
                )}
                {!feed.comments.length ? (
                  <View style={s.empty}>
                    <View style={s.emptySymbol}>
                      <UserRound size={25} color={colors.primaryInk} />
                    </View>
                    <AppText variant="subheading">
                      첫 응원을 남겨 보세요
                    </AppText>
                    <AppText color={colors.textMuted} align="center">
                      짧은 한마디가 다음 달리기의 힘이 돼요.
                    </AppText>
                  </View>
                ) : (
                  feed.comments.map(comment => (
                    <View
                      key={comment.comment_id}
                      style={[s.comment, !!comment.parent_id && s.reply]}
                    >
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${comment.author_name} 프로필`}
                        disabled={comment.deleted}
                        onPress={() => profile(comment.uid)}
                        style={s.avatar}
                      >
                        {comment.author_image && !comment.deleted ? (
                          <Image
                            source={{ uri: comment.author_image }}
                            style={s.avatarImage}
                          />
                        ) : (
                          <UserRound size={17} color={colors.primaryInk} />
                        )}
                      </Pressable>
                      <View style={s.grow}>
                        <View style={s.author}>
                          <AppText variant="label">
                            {comment.deleted
                              ? '삭제된 댓글'
                              : comment.author_name}
                          </AppText>
                          <AppText variant="label" color={colors.textSubtle}>
                            {comment.createdAtMs
                              ? new Date(
                                  comment.createdAtMs,
                                ).toLocaleDateString('ko-KR', {
                                  month: 'numeric',
                                  day: 'numeric',
                                })
                              : ''}
                          </AppText>
                        </View>
                        <AppText
                          selectable
                          style={s.commentText}
                          color={
                            comment.deleted ? colors.textSubtle : colors.text
                          }
                        >
                          {comment.deleted
                            ? '삭제된 댓글입니다.'
                            : `${comment.parent_id ? '↳ ' : ''}${comment.text}`}
                        </AppText>
                        {!comment.deleted && (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`${comment.author_name}에게 답글 쓰기`}
                            disabled={busy}
                            hitSlop={6}
                            onPress={() => {
                              setReply(comment);
                              input.current?.focus();
                            }}
                          >
                            <AppText
                              variant="label"
                              color={colors.primaryInk}
                              style={s.replyButton}
                            >
                              답글 쓰기
                            </AppText>
                          </Pressable>
                        )}
                      </View>
                      {!comment.deleted &&
                        (comment.uid === myUid() || post?.uid === myUid()) && (
                          <IconButton
                            icon={Trash2}
                            size={32}
                            variant="plain"
                            accessibilityLabel="댓글 삭제"
                            disabled={!!deleting}
                            onPress={() => remove(comment)}
                          />
                        )}
                    </View>
                  ))
                )}
              </>
            )}
          </ScrollView>
          {!!error && (
            <AppText
              accessibilityRole="alert"
              variant="caption"
              color={colors.danger}
              style={s.error}
            >
              {error}
            </AppText>
          )}
          <View style={s.composer}>
            {reply && (
              <View style={s.replyNotice}>
                <AppText
                  variant="label"
                  color={colors.primaryInk}
                  style={s.grow}
                >
                  {reply.author_name}님에게 답글
                </AppText>
                <IconButton
                  icon={X}
                  size={30}
                  variant="plain"
                  accessibilityLabel="답글 취소"
                  onPress={() => setReply(null)}
                />
              </View>
            )}
            <View style={s.inputRow}>
              <TextInput
                ref={input}
                multiline
                maxLength={1000}
                accessibilityLabel="댓글 내용"
                placeholder={
                  available
                    ? '응원의 한마디를 남겨 보세요'
                    : '댓글을 작성할 수 없어요'
                }
                placeholderTextColor={colors.textSubtle}
                value={body}
                onChangeText={setBody}
                editable={available && !busy}
                style={s.input}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="댓글 전송"
                accessibilityState={{
                  disabled: !available || busy || !body.trim(),
                }}
                disabled={!available || busy || !body.trim()}
                onPress={send}
                style={[
                  s.send,
                  (!available || busy || !body.trim()) && s.disabled,
                ]}
              >
                {busy ? (
                  <ActivityIndicator color={colors.textOnPrimary} />
                ) : (
                  <ArrowUp size={22} color={colors.textOnPrimary} />
                )}
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  shade: { backgroundColor: 'rgba(17,33,30,0.42)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  grow: { flex: 1 },
  dragHandle: { height: 28, alignItems: 'center', justifyContent: 'center' },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 22,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  comments: { padding: 22, gap: 24, flexGrow: 1 },
  loading: { marginTop: 48 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    gap: 12,
  },
  emptySymbol: {
    width: 54,
    height: 54,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  comment: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  reply: {
    marginLeft: 32,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: colors.primarySoft,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  author: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    paddingBottom: 5,
  },
  commentText: { fontSize: 14, lineHeight: 21 },
  replyButton: { marginTop: 8 },
  composer: {
    paddingHorizontal: 18,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 100,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 22,
    backgroundColor: colors.surfaceMuted,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.text,
  },
  send: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
  replyNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingBottom: 6,
  },
  error: { paddingHorizontal: 20, paddingVertical: 8 },
});
