import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Bell, Settings } from 'lucide-react-native';
import { colors, fonts, spacing } from '../../theme';
import { AppText } from './AppText';
import { IconButton } from './IconButton';

type Props = {
  // 없으면 '달료' 로고를 보여준다 (홈)
  title?: string;
  onNotificationPress: () => void;
  onSettingsPress: () => void;
  hasUnread?: boolean;
};

// 모든 탭 화면 공통 헤더. 왼쪽은 페이지마다 바뀌고(로고/제목), 오른쪽 알림·설정은 고정
export function ScreenHeader({
  title,
  onNotificationPress,
  onSettingsPress,
  hasUnread,
}: Props) {
  return (
    <View style={styles.header}>
      {title ? (
        <AppText
          accessibilityRole="header"
          style={styles.eyebrow}
          color={colors.textMuted}
        >
          {title === '성장'
            ? 'MY PROGRESS'
            : title === '기록'
            ? 'RUNNING JOURNAL'
            : title === '커뮤니티'
            ? 'RUNNER’S CLUB'
            : 'MY DALRYO'}
        </AppText>
      ) : (
        <AppText style={styles.logo} color={colors.primary}>
          달료
        </AppText>
      )}
      <View style={styles.actions}>
        <IconButton
          icon={Bell}
          accessibilityLabel={hasUnread ? '알림, 안 읽은 알림 있음' : '알림'}
          dot={hasUnread}
          size={44}
          onPress={onNotificationPress}
        />
        <IconButton
          icon={Settings}
          accessibilityLabel="설정"
          size={44}
          onPress={onSettingsPress}
        />
      </View>
    </View>
  );
}

export const SCREEN_HEADER_HEIGHT = 48;

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: SCREEN_HEADER_HEIGHT,
  },
  eyebrow: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.6,
  },
  logo: {
    fontFamily: fonts.extrabold,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -1,
  },
  actions: { flexDirection: 'row', gap: spacing.sm },
});
