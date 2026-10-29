import {useCallback, useEffect, useRef, useState} from 'react';
import type {FirebaseFirestoreTypes} from '@react-native-firebase/firestore';
import {
  fetchEarlierNotifications,
  NOTIFICATION_PAGE_SIZE,
  subscribeNotifications,
  subscribeUnreadNotifications,
} from '../services/notification.service';
import type {AppNotification} from '../types/notification.types';
import {mergeNotifications} from '../utils/notifications';

function toNotifications(snap: FirebaseFirestoreTypes.QuerySnapshot) {
  return snap.docs.map(doc => ({...doc.data(), id: doc.id} as AppNotification));
}

export function useUnreadNotifications(uid?: string) {
  const [unread, setUnread] = useState(false);
  useEffect(() => {
    setUnread(false);
    if (!uid) return;
    let active = true;
    const unsubscribe = subscribeUnreadNotifications(value => {
      if (active) setUnread(value);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [uid]);
  return unread;
}

export function useNotifications() {
  const [attempt, setAttempt] = useState(0);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const loadMoreRef = useRef<() => Promise<void>>(async () => {});
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  const loadMore = useCallback(() => loadMoreRef.current(), []);
  const setRead = useCallback(
    (id: string) => setItems(previous => previous.map(item => (item.id === id ? {...item, is_read: true} : item))),
    [],
  );

  useEffect(() => {
    let active = true;
    let cursor: FirebaseFirestoreTypes.QueryDocumentSnapshot | undefined;
    let fetchedOlder = false;
    let pending = false;
    setItems([]);
    setStatus('loading');
    setMoreError(false);
    setLoadingMore(false);
    setHasMore(false);

    loadMoreRef.current = async () => {
      if (!active || !cursor || pending) return;
      pending = true;
      setLoadingMore(true);
      setMoreError(false);
      try {
        const snap = await fetchEarlierNotifications(cursor);
        if (!active) return;
        fetchedOlder = true;
        if (snap.docs.length) cursor = snap.docs[snap.docs.length - 1];
        setItems(previous => mergeNotifications(previous, toNotifications(snap)));
        setHasMore(snap.size === NOTIFICATION_PAGE_SIZE);
      } catch {
        if (active) setMoreError(true);
      } finally {
        pending = false;
        if (active) setLoadingMore(false);
      }
    };
    const unsubscribe = subscribeNotifications(
      snap => {
        if (!active) return;
        setItems(previous => mergeNotifications(previous, toNotifications(snap)));
        setStatus('success');
        if (!fetchedOlder) {
          cursor = snap.docs[snap.docs.length - 1];
          setHasMore(snap.size === NOTIFICATION_PAGE_SIZE);
        }
      },
      () => {
        if (active) setStatus('error');
      },
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [attempt]);
  return {items, status, retry, loadMore, loadingMore, moreError, hasMore, setRead};
}
