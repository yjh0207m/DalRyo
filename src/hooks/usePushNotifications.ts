import {useEffect, useRef, useState} from 'react';
import {auth, firestore, messaging} from '../lib/firebase';

export function usePushNotifications(uid: string | undefined, enabled: boolean, onOpen: () => void) {
  const open = useRef(onOpen);
  open.current = onOpen;
  const [notice, setNotice] = useState<{title: string; body: string} | null>(null);
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
      if (!cancelled) setNotice({title: message.notification?.title ?? '달료', body: message.notification?.body ?? '새 알림이 있어요.'});
    });
    const stopOpen = messaging().onNotificationOpenedApp(() => {if (!cancelled) open.current();});
    messaging().getInitialNotification().then(message => {if (message && !cancelled) open.current();}).catch(() => undefined);
    return () => {cancelled = true; stopToken(); stopMessage(); stopOpen();};
  }, [uid, enabled]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  return {notice, dismiss: () => setNotice(null)};
}
