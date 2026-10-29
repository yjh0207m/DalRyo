import React from 'react';
import {ActivityIndicator, StyleSheet, View} from 'react-native';
import {RefreshCw} from 'lucide-react-native';
import {colors, spacing} from '../../theme';
import {AppText} from './AppText';
import {Button} from './Button';

export function RunRecordsStatus({status, onRetry}: {status: 'loading' | 'error'; onRetry: () => void}) {
  return (
    <View style={styles.container} accessibilityLiveRegion="polite">
      {status === 'loading' ? (
        <>
          <ActivityIndicator color={colors.primary} />
          <AppText variant="caption" color={colors.textMuted}>
            기록을 불러오는 중이에요
          </AppText>
        </>
      ) : (
        <>
          <AppText variant="subheading" align="center">
            기록을 불러오지 못했어요
          </AppText>
          <AppText variant="caption" color={colors.textMuted} align="center">
            잠시 후 다시 시도해 주세요.
          </AppText>
          <Button label="다시 시도" icon={RefreshCw} variant="secondary" size="md" onPress={onRetry} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {paddingVertical: spacing.xl, gap: spacing.md},
});
