import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  dismissBackgroundTask,
  retryBackgroundTask,
  useBackgroundToasts,
  type BackgroundToast,
} from '../../services/backgroundTask.service';
import { colors, radius, shadow, spacing } from '../../theme';
import { AppText } from './AppText';

// 백그라운드로 처리하는 요청의 진행·완료·실패를 화면 위쪽에 작게 띄운다
export function BackgroundTaskToast() {
  const insets = useSafeAreaInsets();
  const toasts = useBackgroundToasts();
  if (toasts.length === 0) return null;
  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { top: insets.top + spacing.sm }]}
    >
      {toasts.map(toast => (
        <Toast key={toast.id} toast={toast} />
      ))}
    </View>
  );
}

function Toast({ toast }: { toast: BackgroundToast }) {
  const failed = toast.kind === 'failed';
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.toast, failed && styles.failed]}
    >
      {toast.kind === 'running' && (
        <ActivityIndicator size="small" color={colors.primary} />
      )}
      {toast.kind === 'done' && (
        <AppText variant="subheading" color={colors.primary}>
          ✓
        </AppText>
      )}
      <View style={styles.text}>
        <AppText
          variant="caption"
          color={failed ? colors.danger : colors.text}
          numberOfLines={1}
        >
          {toast.message}
          {toast.kind === 'running' && toast.percent !== null
            ? ` · ${toast.percent}%`
            : ''}
        </AppText>
        {failed && !!toast.detail && (
          <AppText variant="label" color={colors.textMuted} numberOfLines={2}>
            {toast.detail}
          </AppText>
        )}
      </View>
      {failed && toast.retryable && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="다시 시도"
          hitSlop={8}
          onPress={() => retryBackgroundTask(toast.id)}
        >
          <AppText variant="label" color={colors.primaryInk}>
            다시 시도
          </AppText>
        </Pressable>
      )}
      {failed && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="닫기"
          hitSlop={8}
          onPress={() => dismissBackgroundTask(toast.id)}
        >
          <AppText variant="label" color={colors.textMuted}>
            닫기
          </AppText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    maxWidth: '100%',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    ...shadow.floating,
  },
  failed: { borderRadius: radius.lg, borderColor: colors.danger },
  text: { flexShrink: 1 },
});
