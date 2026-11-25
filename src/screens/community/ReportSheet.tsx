import React, { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { AppText, BottomSheet, Button } from '../../components/ui';
import { runInBackground } from '../../services/backgroundTask.service';
import { socialError, socialRequest } from '../../services/social.service';
import { colors, fonts, radius, spacing, themedStyles } from '../../theme';

// 신고할 수 있는 이유. 서버(socialAction의 REPORT_REASONS)와 같은 목록이다
export const REPORT_REASONS: Array<{ value: string; label: string }> = [
  { value: 'spam', label: '스팸·광고' },
  { value: 'abuse', label: '욕설·괴롭힘' },
  { value: 'hate', label: '혐오 표현' },
  { value: 'sexual', label: '음란·선정적인 내용' },
  { value: 'danger', label: '폭력·위험한 행동' },
  { value: 'fraud', label: '사칭·사기' },
  { value: 'privacy', label: '개인정보 노출' },
  { value: 'other', label: '기타' },
];
const MAX_DETAIL = 500;

export type ReportTarget =
  | { type: 'post'; id: string }
  | { type: 'comment'; id: string; postId: string }
  | { type: 'user'; id: string }
  | { type: 'chat'; id: string; uid?: string };

const TARGET_NAME: Record<ReportTarget['type'], string> = {
  post: '게시물',
  comment: '댓글',
  user: '러너',
  chat: '대화',
};

// 신고를 서버에 보낸다. 기다리지 않고 작은 팝업으로 진행과 결과만 알린다.
// also: 신고와 함께 할 일(예: 게시물 숨기기)
export function sendReport(
  target: ReportTarget,
  reason: string,
  detail: string,
  options: { successLabel?: string; also?: () => Promise<unknown> } = {},
) {
  runInBackground({
    label: '신고하는 중',
    successLabel: options.successLabel ?? '신고했어요. 운영팀이 확인할게요',
    failureLabel: '신고하지 못했어요',
    retryable: true,
    describeError: socialError,
    task: async () => {
      await socialRequest('report', {
        targetType: target.type,
        targetId: target.id,
        ...(target.type === 'comment' ? { postId: target.postId } : {}),
        ...(target.type === 'chat' && target.uid ? { uid: target.uid } : {}),
        reason,
        detail: detail.trim(),
      });
      await options.also?.();
    },
  });
}

// 신고 이유를 고르고(필수) 자세한 내용을 적는(선택) 시트. "신고하기"를 누르면 시트가 내려간 뒤 onSubmit을 부른다
export function ReportSheet({
  target,
  note,
  onSubmit,
  onClose,
}: {
  target: ReportTarget;
  // 신고하면 함께 일어나는 일 안내(예: "신고한 게시물은 더 이상 보이지 않아요")
  note?: string;
  onSubmit: (reason: string, detail: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<string | null>(null);
  const [detail, setDetail] = useState('');
  const name = TARGET_NAME[target.type];
  return (
    <BottomSheet
      title={`${name} 신고`}
      testID="report-sheet"
      onClose={onClose}
      renderFooter={close => (
        <Button
          label="신고하기"
          variant="danger"
          disabled={!reason}
          onPress={() => {
            if (!reason) return;
            close(() => onSubmit(reason, detail));
          }}
        />
      )}
    >
      <AppText variant="caption" color={colors.textMuted} style={styles.intro}>
        {`신고 이유를 골라 주세요. 신고한 사람은 상대에게 알려지지 않아요.${
          note ? ` ${note}` : ''
        }`}
      </AppText>
      <View accessibilityRole="radiogroup">
        {REPORT_REASONS.map(item => {
          const selected = reason === item.value;
          return (
            <Pressable
              key={item.value}
              accessibilityRole="radio"
              accessibilityLabel={item.label}
              accessibilityState={{ selected }}
              onPress={() => setReason(item.value)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={[styles.radio, selected && styles.radioOn]}>
                {selected && <View style={styles.radioDot} />}
              </View>
              <AppText variant="body">{item.label}</AppText>
            </Pressable>
          );
        })}
      </View>
      <TextInput
        accessibilityLabel="신고 내용"
        value={detail}
        onChangeText={setDetail}
        maxLength={MAX_DETAIL}
        multiline
        placeholder="자세한 내용을 적어 주세요(선택)"
        placeholderTextColor={colors.textSubtle}
        style={styles.input}
      />
    </BottomSheet>
  );
}

const styles = themedStyles(() => ({
  intro: { marginBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 46,
  },
  pressed: { opacity: 0.7 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: colors.primary },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  input: {
    marginTop: spacing.md,
    minHeight: 80,
    textAlignVertical: 'top',
    // 바탕색을 주어야 안드로이드 기본 밑줄이 테두리 상자 안에 겹쳐 보이지 않는다
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
}));
