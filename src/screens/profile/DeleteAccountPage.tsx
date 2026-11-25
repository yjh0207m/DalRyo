import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, ChevronLeft } from 'lucide-react-native';
import { AppText, Button, IconButton } from '../../components/ui';
import { deleteMyAccount } from '../../services/account.service';
import { colors, radius, spacing, themedStyles } from '../../theme';

// 탈퇴하면 지워지는 것과 남는 것. 서버 deleteAccount가 하는 일과 같다
const DELETED = [
  '프로필·아이디·캐릭터와 보관함 아이템',
  '달리기 기록과 공원 랭킹 기록',
  '내 게시물(달린 댓글·응원 포함)과 사진',
  '다른 러너의 글에 남긴 댓글·응원',
  '팔로우·팔로워, 저장한 게시물, 차단 목록',
];
const KEPT = [
  '채팅 메시지는 상대의 대화 기록이라 남고, 보낸 사람은 "탈퇴한 러너"로 보여요.',
];

// 회원 탈퇴. 지워지는 것을 알리고, 확인을 한 번 더 받은 뒤 서버에서 모두 지우고 로그아웃한다
export function DeleteAccountPage({
  insetsBottom,
  onBack,
}: {
  insetsBottom: number;
  onBack: () => void;
}) {
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );
  const leave = useCallback(() => {
    if (!busy) onBack();
  }, [busy, onBack]);
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        leave();
        return true;
      },
    );
    return () => subscription.remove();
  }, [leave]);
  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      // 끝나면 로그아웃되어 시작 화면으로 바뀐다
      await deleteMyAccount();
    } catch {
      if (!alive.current) return;
      setBusy(false);
      setError(
        '탈퇴를 마치지 못했어요. 잠시 후 다시 시도해 주세요. 이미 지운 것은 다시 시도하면 이어서 지워요.',
      );
    }
  };
  const confirm = () =>
    Alert.alert(
      '정말 탈퇴할까요?',
      '모든 기록과 캐릭터가 지워지고 되돌릴 수 없어요.',
      [
        { text: '취소', style: 'cancel' },
        { text: '탈퇴', style: 'destructive', onPress: remove },
      ],
    );
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <IconButton
          icon={ChevronLeft}
          variant="plain"
          accessibilityLabel="회원 탈퇴에서 뒤로"
          disabled={busy}
          onPress={leave}
        />
        <AppText
          variant="heading"
          accessibilityRole="header"
          style={styles.headerTitle}
        >
          회원 탈퇴
        </AppText>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="title">달료와의 기록이 모두 사라져요</AppText>
        <AppText color={colors.textMuted}>
          탈퇴하면 아래 내용이 바로 지워지고, 같은 번호로 다시 가입해도 되살릴
          수 없어요.
        </AppText>
        <View style={styles.box}>
          <AppText variant="subheading">지워지는 것</AppText>
          {DELETED.map(item => (
            <AppText key={item} color={colors.textMuted}>
              · {item}
            </AppText>
          ))}
        </View>
        <View style={styles.box}>
          <AppText variant="subheading">남는 것</AppText>
          {KEPT.map(item => (
            <AppText key={item} color={colors.textMuted}>
              · {item}
            </AppText>
          ))}
        </View>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityLabel="위 내용을 확인했어요"
          accessibilityState={{ checked: agreed, disabled: busy }}
          disabled={busy}
          onPress={() => setAgreed(value => !value)}
          style={styles.agree}
        >
          <View style={[styles.check, agreed && styles.checkOn]}>
            {agreed && <Check size={16} color={colors.textOnPrimary} />}
          </View>
          <AppText>위 내용을 확인했어요</AppText>
        </Pressable>
      </ScrollView>
      <View
        style={[styles.footer, { paddingBottom: insetsBottom + spacing.sm }]}
      >
        {error && (
          <AppText
            variant="caption"
            color={colors.danger}
            accessibilityRole="alert"
          >
            {error}
          </AppText>
        )}
        {busy ? (
          <View style={styles.busy}>
            <ActivityIndicator color={colors.danger} />
            <AppText color={colors.textMuted}>탈퇴하는 중이에요…</AppText>
          </View>
        ) : (
          <Button
            label="탈퇴하기"
            variant="danger"
            disabled={!agreed}
            onPress={confirm}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = themedStyles(() => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    minHeight: 52,
  },
  headerTitle: { flex: 1 },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  box: {
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  agree: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  busy: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
}));
