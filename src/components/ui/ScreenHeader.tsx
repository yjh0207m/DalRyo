import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Bell, Plus, Settings } from 'lucide-react-native';
import { colors, fonts } from '../../theme';
import { AppText } from './AppText';
import { IconButton } from './IconButton';

type Props = {
  // 없으면 '달료' 로고를 보여준다 (홈)
  title?: string;
  onNotificationPress: () => void;
  onSettingsPress: () => void;
  hasUnread?: boolean;
  // 있으면 알림 앞에 글쓰기(+) 버튼을 둔다(커뮤니티)
  onCreatePress?: () => void;
};

// 커뮤니티 서브 메뉴 화면(탐색·메시지·내 프로필)의 헤더. 탭 화면 헤더와 높이·글자·버튼 크기가 같고,
// 왼쪽에는 영문 작은 제목, 오른쪽에는 그 화면의 버튼(children)을 둔다
export function SectionHeader({
  label,
  accessibilityLabel,
  children,
}: {
  // 영문 대문자 제목(예: EXPLORE)
  label: string;
  // 화면 읽기 프로그램이 읽을 한글 이름(예: 탐색)
  accessibilityLabel: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.header}>
      <AppText
        accessibilityRole="header"
        accessibilityLabel={accessibilityLabel}
        style={styles.eyebrow}
        color={colors.textMuted}
        numberOfLines={1}
      >
        {label}
      </AppText>
      <View style={styles.actions}>{children}</View>
    </View>
  );
}

// 모든 탭 화면 공통 헤더. 왼쪽은 페이지마다 바뀌고(로고/제목), 오른쪽 알림·설정은 고정
export function ScreenHeader({
  title,
  onNotificationPress,
  onSettingsPress,
  hasUnread,
  onCreatePress,
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
        <AppText style={styles.logo} color={colors.primaryInk}>
          달료
        </AppText>
      )}
      <View style={styles.actions}>
        {onCreatePress && (
          <IconButton
            icon={Plus}
            accessibilityLabel="글쓰기"
            size={44}
            onPress={onCreatePress}
          />
        )}
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
  // 버튼끼리 붙여 둔다. 누르는 영역(44)은 그대로고, 아이콘 사이는 약 22만큼 떨어진다
  actions: { flexDirection: 'row' },
});
