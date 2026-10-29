import React from 'react';
import {act, create, type ReactTestRenderer} from 'react-test-renderer';
import type {FirebaseFirestoreTypes} from '@react-native-firebase/firestore';
import {useNotifications} from '../src/hooks/useNotifications';

let mockNext: (snap: FirebaseFirestoreTypes.QuerySnapshot) => void;
let mockError: () => void;
const mockUnsubscribe = jest.fn();
const mockFetch = jest.fn();
jest.mock('../src/services/notification.service', () => ({
  NOTIFICATION_PAGE_SIZE: 20,
  subscribeNotifications: (next: typeof mockNext, error: () => void) => {
    mockNext = next;
    mockError = error;
    return mockUnsubscribe;
  },
  fetchEarlierNotifications: (...args: unknown[]) => mockFetch(...args),
}));
function snapshot(count: number, prefix = 'new', is_read = false) {
  const docs = Array.from({length: count}, (_, index) => ({
    id: `${prefix}-${index}`,
    data: () => ({type: 'level_up', is_read, created_at: {toMillis: () => 100 - index}}),
  }));
  return {docs, size: count} as unknown as FirebaseFirestoreTypes.QuerySnapshot;
}
let current: ReturnType<typeof useNotifications>;
function Probe() {
  current = useNotifications();
  return null;
}
let renderer: ReactTestRenderer;
beforeEach(() => {
  jest.clearAllMocks();
});
afterEach(async () => {
  await act(async () => renderer.unmount());
});

test('추가 페이지를 불러온 뒤에도 실시간 읽음 변경을 유지한다', async () => {
  await act(async () => {
    renderer = create(<Probe />);
  });
  expect(current.status).toBe('loading');
  await act(async () => mockNext(snapshot(20)));
  expect(current.hasMore).toBe(true);
  mockFetch.mockResolvedValue(snapshot(2, 'old'));
  await act(async () => current.loadMore());
  expect(current.items).toHaveLength(22);
  expect(current.hasMore).toBe(false);
  await act(async () => mockNext(snapshot(20, 'new', true)));
  expect(current.items).toHaveLength(22);
  expect(current.items.find(item => item.id === 'new-0')?.is_read).toBe(true);
  await act(async () => current.setRead('old-0'));
  expect(current.items.find(item => item.id === 'old-0')?.is_read).toBe(true);
});
test('추가 조회 실패 시 기존 알림을 유지하고 재시도한다', async () => {
  await act(async () => {
    renderer = create(<Probe />);
  });
  // 구독 등록 뒤 첫 페이지를 전달한다
  await act(async () => mockNext(snapshot(20)));
  mockFetch.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(snapshot(0));
  await act(async () => current.loadMore());
  expect(current.moreError).toBe(true);
  expect(current.items).toHaveLength(20);
  await act(async () => current.loadMore());
  expect(current.moreError).toBe(false);
  expect(current.hasMore).toBe(false);
});
test('구독 오류 후 재시도하면 이전 구독을 해제한다', async () => {
  await act(async () => {
    renderer = create(<Probe />);
  });
  await act(async () => mockError());
  expect(current.status).toBe('error');
  await act(async () => current.retry());
  expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  await act(async () => mockNext(snapshot(0)));
  expect(current.status).toBe('success');
  expect(current.items).toHaveLength(0);
});
