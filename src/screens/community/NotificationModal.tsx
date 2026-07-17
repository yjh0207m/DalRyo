import React, {useEffect, useState} from 'react';
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  markAllRead,
  subscribeNotifications,
  type AppNotification,
} from '../../services/notification.service';

const MINT = '#58CFA6';
const MINT_DEEP = '#2BAF85';
const TEXT = '#1A1A1A';
const MUTED = '#9A9A9A';

const TYPE_LABEL: Record<AppNotification['type'], string> = {
  like: '회원님의 게시물에 🔥를 눌렀어요',
  join: '회원님의 게시물에 👟를 눌렀어요',
  comment: '회원님의 게시물에 댓글을 남겼어요',
  reply: '댓글에 답글을 달았어요',
};

type Props = {visible: boolean; onClose: () => void};

export function NotificationModal({visible, onClose}: Props) {
  const [notifs, setNotifs] = useState<AppNotification[]>([]);

  useEffect(() => {
    if (!visible) return;
    const unsub = subscribeNotifications(setNotifs);
    return unsub;
  }, [visible]);

  const handleClose = async () => {
    markAllRead().catch(() => {});
    onClose();
  };

  const unreadCount = notifs.filter(n => !n.read).length;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose} statusBarTranslucent>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>
              알림{unreadCount > 0 ? <Text style={styles.badge}> {unreadCount}</Text> : ''}
            </Text>
            <TouchableOpacity activeOpacity={0.75} onPress={handleClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={notifs}
            keyExtractor={n => n.notif_id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyEmoji}>🔔</Text>
                <Text style={styles.emptyText}>아직 알림이 없어요</Text>
              </View>
            }
            renderItem={({item}) => <NotifItem notif={item} />}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        </View>
      </View>
    </Modal>
  );
}

function NotifItem({notif}: {notif: AppNotification}) {
  return (
    <View style={[styles.notifItem, !notif.read && styles.notifItemUnread]}>
      <View style={[styles.notifDot, notif.read && styles.notifDotRead]} />
      <View style={styles.notifBody}>
        <Text style={styles.notifFrom}>{notif.from_name}</Text>
        <Text style={styles.notifText}>{TYPE_LABEL[notif.type]}</Text>
        <Text style={styles.notifTime}>{relativeTime(notif.created_at)}</Text>
      </View>
    </View>
  );
}

function relativeTime(ts: any): string {
  const date = ts?.toDate?.() ?? new Date();
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return '방금';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

const styles = StyleSheet.create({
  overlay: {flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)'},
  backdrop: {flex: 1},
  sheet: {backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '70%'},
  handle: {width: 40, height: 4, borderRadius: 2, backgroundColor: '#E0E0E0', alignSelf: 'center', marginTop: 12, marginBottom: 4},
  header: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F0F0F0'},
  title: {color: TEXT, fontSize: 17, fontWeight: '900'},
  badge: {color: MINT, fontWeight: '900'},
  closeBtn: {width: 32, height: 32, borderRadius: 16, backgroundColor: '#F4F4F4', alignItems: 'center', justifyContent: 'center'},
  closeBtnText: {color: '#555', fontSize: 13, fontWeight: '700'},
  listContent: {paddingHorizontal: 0, paddingBottom: 24},
  emptyWrap: {alignItems: 'center', paddingVertical: 60},
  emptyEmoji: {fontSize: 40, marginBottom: 12},
  emptyText: {color: MUTED, fontSize: 15, fontWeight: '700'},
  separator: {height: 1, backgroundColor: '#F5F5F5'},
  notifItem: {flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 20, paddingVertical: 14, gap: 12},
  notifItemUnread: {backgroundColor: '#F5FDF9'},
  notifDot: {width: 8, height: 8, borderRadius: 4, backgroundColor: MINT, marginTop: 5},
  notifDotRead: {backgroundColor: '#E0E0E0'},
  notifBody: {flex: 1},
  notifFrom: {color: TEXT, fontSize: 14, fontWeight: '900', marginBottom: 2},
  notifText: {color: '#555', fontSize: 13, fontWeight: '500'},
  notifTime: {color: MUTED, fontSize: 12, fontWeight: '600', marginTop: 4},
});
