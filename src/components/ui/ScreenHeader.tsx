import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Bell, Settings} from 'lucide-react-native';
import {colors, fonts, spacing} from '../../theme';
import {AppText} from './AppText';
import {IconButton} from './IconButton';

type Props = {
  // 없으면 '달료' 로고를 보여준다 (홈)
  title?: string;
  onNotificationPress: () => void;
  onSettingsPress: () => void;
  hasUnread?: boolean;
};

// 모든 탭 화면 공통 헤더. 왼쪽은 페이지마다 바뀌고(로고/제목), 오른쪽 알림·설정은 고정
export function ScreenHeader({title, onNotificationPress, onSettingsPress, hasUnread}: Props) {
  return (
    <View style={styles.header}>
      {title ? (
        <AppText variant="title">{title}</AppText>
      ) : (
        <AppText style={styles.logo} color={colors.primary}>
          달료
        </AppText>
      )}
      <View style={styles.actions}>
        <IconButton icon={Bell} accessibilityLabel="알림" dot={hasUnread} size={40} onPress={onNotificationPress} />
        <IconButton icon={Settings} accessibilityLabel="설정" size={40} onPress={onSettingsPress} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48},
  logo: {fontFamily: fonts.extrabold, fontSize: 30, lineHeight: 36, letterSpacing: -1},
  actions: {flexDirection: 'row', gap: spacing.sm},
});
