import React, {useEffect} from 'react';
import {ActivityIndicator, Alert, BackHandler, FlatList, Pressable, StatusBar, StyleSheet, View} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {Bell, ChevronLeft, ChevronRight} from 'lucide-react-native';
import {AppText, Badge, Button, Card, IconButton} from '../../components/ui';
import {useNotifications} from '../../hooks/useNotifications';
import {useDialect} from '../../locales/DialectProvider';
import {runInBackground} from '../../services/backgroundTask.service';
import {markNotificationRead} from '../../services/notification.service';
import {colors, spacing, themedStyles, statusBarStyle} from '../../theme';
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
      <StatusBar barStyle={statusBarStyle()} backgroundColor={colors.surface} />
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} variant="plain" accessibilityLabel="알림에서 뒤로" onPress={onBack} />
        <AppText variant="heading" accessibilityRole="header" style={styles.headerTitle}>알림</AppText>
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
          contentContainerStyle={[items.length > 0 && styles.content, {paddingBottom: insets.bottom + spacing.xxl}]}
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
                    {/* 안 읽은 줄은 연한 민트 바탕이라 흰 표시로 둔다 */}
                    {!item.is_read && <Badge label="새 알림" tone="onSoft" />}
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

const styles = themedStyles(() => ({
  // 피드처럼 흰 바탕 위에 알림을 화면 양끝까지 한 줄씩 늘어놓고 가는 선으로 나눈다
  screen: {flex: 1, backgroundColor: colors.surface},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    minHeight: 52,
  },
  headerTitle: {flex: 1},
  center: {flex: 1, justifyContent: 'center', padding: spacing.xxl, gap: spacing.lg},
  content: {borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border},
  empty: {alignItems: 'center', gap: spacing.lg, marginTop: spacing.xxl, marginHorizontal: spacing.xl, paddingVertical: spacing.xxxl},
  // 알림 한 줄. 상자 없이 화면 양끝까지 쓰고 아래 가는 선으로 다음 알림과 나눈다. 글자는 본문과 같은 선(좌우 20)에 맞춘다
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.md,
  },
  itemBody: {flex: 1, gap: spacing.xs},
  // 안 읽은 알림은 줄 전체를 연한 민트로 칠한다
  unread: {backgroundColor: colors.primarySoft},
  pressed: {backgroundColor: colors.surfaceMuted},
  itemHeading: {flexDirection: 'row', gap: spacing.sm, alignItems: 'center'},
  title: {flex: 1},
  itemFooter: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  footer: {marginVertical: spacing.lg, marginHorizontal: spacing.xl},
}));
