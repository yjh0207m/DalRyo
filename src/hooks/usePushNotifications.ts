import {useEffect, useRef, useState} from 'react';
import type {FirebaseMessagingTypes} from '@react-native-firebase/messaging';
import {auth, firestore, messaging} from '../lib/firebase';

function chatRoomId(message: FirebaseMessagingTypes.RemoteMessage) {
  const id = message.data?.target_id;
  return message.data?.type === 'chat' && typeof id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(id)
    ? id : undefined;
}

export function usePushNotifications(uid: string | undefined, enabled: boolean, onOpen: (roomId?: string) => void) {
  const open = useRef(onOpen);
  open.current = onOpen;
  const [notice, setNotice] = useState<{title: string; body: string; roomId?: string} | null>(null);
  useEffect(() => {
    setNotice(null);
    if (!uid) return;
    let cancelled = false;
    const store = async (token: string | null) => {
      if (!cancelled && auth().currentUser?.uid === uid) await firestore().collection('users').doc(uid).update({fcm_token: token}).catch(() => undefined);
    };
    if (!enabled) {store(null); return () => {cancelled = true;};}
    const sync = async () => {
      const permission = await messaging().hasPermission();
      if (permission === messaging.AuthorizationStatus.AUTHORIZED || permission === messaging.AuthorizationStatus.PROVISIONAL) await store(await messaging().getToken());
    };
    sync().catch(() => undefined);
    const stopToken = messaging().onTokenRefresh(token => {store(token);});
    const stopMessage = messaging().onMessage(async message => {
      if (!cancelled) setNotice({title: message.notification?.title ?? '달료', body: message.notification?.body ?? '새 알림이 있어요.', roomId: chatRoomId(message)});
    });
    const stopOpen = messaging().onNotificationOpenedApp(message => {if (!cancelled) open.current(chatRoomId(message));});
    messaging().getInitialNotification().then(message => {if (message && !cancelled) open.current(chatRoomId(message));}).catch(() => undefined);
    return () => {cancelled = true; stopToken(); stopMessage(); stopOpen();};
  }, [uid, enabled]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  return {notice, dismiss: () => setNotice(null)};
}
