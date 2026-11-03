import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Image,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, UserRound } from 'lucide-react-native';
import { AppText, Button, IconButton } from '../../components/ui';
import { runInBackground } from '../../services/backgroundTask.service';
import {
  socialError,
  socialRequest,
  watchBlockedUsers,
  type BlockedUser,
} from '../../services/social.service';
import { colors, spacing } from '../../theme';

// 설정의 "차단한 사용자". 목록은 실시간이라 해제하면 바로 사라진다
export function BlockedUsersScreen({ onBack }: { onBack: () => void }) {
  const [users, setUsers] = useState<BlockedUser[] | null>(null);
  useEffect(() => watchBlockedUsers(setUsers), []);
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        onBack();
        return true;
      },
    );
    return () => subscription.remove();
  }, [onBack]);
  const unblock = (user: BlockedUser) =>
    runInBackground({
      label: '차단 해제 중',
      successLabel: '차단을 해제했어요',
      failureLabel: '차단을 해제하지 못했어요',
      describeError: socialError,
      task: () => socialRequest('blockUser', { uid: user.uid, blocked: false }),
    });
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <IconButton
          icon={ChevronLeft}
          variant="plain"
          accessibilityLabel="차단한 사용자에서 뒤로"
          onPress={onBack}
        />
        <AppText variant="heading">차단한 사용자</AppText>
      </View>
      {users === null ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : users.length === 0 ? (
        <View style={styles.empty}>
          <AppText variant="subheading">차단한 사용자가 없어요</AppText>
          <AppText color={colors.textMuted} align="center">
            게시물의 메뉴에서 러너를 차단할 수 있어요.
          </AppText>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {users.map(user => (
            <View key={user.uid} style={styles.row}>
              <View style={styles.avatar}>
                {user.profile_image ? (
                  <Image
                    source={{ uri: user.profile_image }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <UserRound size={20} color={colors.primaryInk} />
                )}
              </View>
              <View style={styles.grow}>
                <AppText variant="subheading" numberOfLines={1}>
                  {user.display_name}
                </AppText>
                {!!user.user_id && (
                  <AppText variant="caption" color={colors.textMuted}>
                    @{user.user_id}
                  </AppText>
                )}
              </View>
              <Button
                label="차단 해제"
                size="md"
                variant="secondary"
                onPress={() => unblock(user)}
              />
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  loading: { marginTop: 48 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
  },
  list: { padding: spacing.xl, gap: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  grow: { flex: 1 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  avatarImage: { width: '100%', height: '100%' },
});
