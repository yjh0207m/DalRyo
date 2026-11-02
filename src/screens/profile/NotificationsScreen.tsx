import React, {useEffect} from 'react';
import {ActivityIndicator, Alert, BackHandler, FlatList, Pressable, StatusBar, StyleSheet, View} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {Bell, ChevronLeft, ChevronRight} from 'lucide-react-native';
import {AppText, Badge, Button, Card, IconButton} from '../../components/ui';
import {useNotifications} from '../../hooks/useNotifications';
import {useDialect} from '../../locales/DialectProvider';
import {runInBackground} from '../../services/backgroundTask.service';
import {markNotificationRead} from '../../services/notification.service';
import {colors, radius, spacing} from '../../theme';
import type {AppNotification} from '../../types/notification.types';
import {describeNotification, notificationTarget, notificationTime, type NotificationTarget} from '../../utils/notifications';
import {NotificationAvatar} from './NotificationAvatar';

// 알림을 누르면 알림이 가리키는 곳(게시물, 프로필, 같이 달리기 등)으로 onNavigate가 이동시킨다.
// 갈 곳을 알 수 없거나 onNavigate가 없으면 내용을 안내 창으로만 보여 준다
export function NotificationsScreen({onBack, onNavigate}: {onBack: () => void; onNavigate?: (target: NotificationTarget) => void}) {
  const {items, status, retry, loadMore, loadingMore, moreError, hasMore, setRead} = useNotifications();
  const t = useDialect();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => subscription.remove();
  }, [onBack]);

  const openNotification = (item: AppNotification) => {
    if (!item.is_read) {
      // 읽음 표시는 서버에 알리는 일일 뿐이라 기다리지 않고 바로 열고, 실패하면 작은 팝업으로만 알린다
      setRead(item.id);
      runInBackground({
        label: '',
        failureLabel: '알림을 읽음으로 표시하지 못했어요',
        silent: true,
        retryable: false,
        task: () => markNotificationRead(item.id),
      });
    }
    const target = notificationTarget(item);
    if (target && onNavigate) {
      onNavigate(target);
      return;
    }
    const {title, body} = describeNotification(item, t);
    Alert.alert(title, body, [{text: '확인'}]);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} variant="plain" accessibilityLabel="알림에서 뒤로" onPress={onBack} />
        <AppText variant="heading">알림</AppText>
        <View style={styles.spacer} />
      </View>
      {status === 'loading' ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
          <AppText variant="caption">알림을 불러오는 중이에요</AppText>
        </View>
      ) : status === 'error' ? (
        <View style={styles.center}>
          <AppText variant="subheading">알림을 불러오지 못했어요</AppText>
          <Button label="다시 시도" variant="secondary" onPress={retry} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          contentContainerStyle={[styles.content, {paddingBottom: insets.bottom + spacing.xxl}]}
          refreshing={false}
          onRefresh={retry}
          ListEmptyComponent={
            <Card style={styles.empty}>
              <Bell color={colors.textMuted} size={32} />
              <AppText variant="subheading">아직 도착한 알림이 없어요</AppText>
              <AppText variant="caption" color={colors.textMuted} align="center">
                캐릭터 성장과 달료의 소식을 여기서 확인해요.
              </AppText>
            </Card>
          }
          renderItem={({item}) => {
            const {title, body} = describeNotification(item, t);
            const time = notificationTime(item);
            const date = time ? new Date(time) : null;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${item.is_read ? '읽은 알림' : '안 읽은 알림'}, ${title}, ${body}`}
                onPress={() => openNotification(item)}
                style={({pressed}) => [styles.item, !item.is_read && styles.unread, pressed && styles.pressed]}
              >
                <NotificationAvatar item={item} />
                <View style={styles.itemBody}>
                  <View style={styles.itemHeading}>
                    <AppText variant="subheading" style={styles.title}>
                      {title}
                    </AppText>
                    {!item.is_read && <Badge label="새 알림" />}
                  </View>
                  <AppText variant="caption" color={colors.textMuted}>
                    {body}
                  </AppText>
                  <View style={styles.itemFooter}>
                    <AppText variant="label" color={colors.textMuted}>
                      {date
                        ? `${date.getMonth() + 1}월 ${date.getDate()}일 ${String(date.getHours()).padStart(2, '0')}:${String(
                            date.getMinutes(),
                          ).padStart(2, '0')}`
                        : '방금'}
                    </AppText>
                    <ChevronRight size={16} color={colors.textMuted} />
                  </View>
                </View>
              </Pressable>
            );
          }}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator color={colors.primary} style={styles.footer} />
            ) : moreError ? (
              <Button label="이전 알림 다시 불러오기" variant="secondary" onPress={loadMore} style={styles.footer} />
            ) : hasMore ? (
              <Button label="이전 알림 더 보기" variant="secondary" onPress={loadMore} style={styles.footer} />
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: colors.background},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  spacer: {width: 44},
  center: {flex: 1, justifyContent: 'center', padding: spacing.xxl, gap: spacing.lg},
  content: {paddingHorizontal: spacing.xl, paddingTop: spacing.md},
  empty: {alignItems: 'center', gap: spacing.lg, marginTop: spacing.xxl, paddingVertical: spacing.xxxl},
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.md,
  },
  itemBody: {flex: 1, gap: spacing.xs},
  unread: {borderColor: colors.primaryBorder, backgroundColor: colors.primarySoft},
  pressed: {opacity: 0.7},
  itemHeading: {flexDirection: 'row', gap: spacing.sm, alignItems: 'center'},
  title: {flex: 1},
  itemFooter: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  footer: {marginVertical: spacing.lg},
});
