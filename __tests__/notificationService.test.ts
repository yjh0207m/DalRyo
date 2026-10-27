import {markNotificationRead, subscribeUnreadNotifications, fetchEarlierNotifications} from '../src/services/notification.service';
import type {FirebaseFirestoreTypes} from '@react-native-firebase/firestore';

const mockUpdate = jest.fn().mockResolvedValue(undefined);
const mockOnSnapshot = jest.fn();
const mockQuery = {
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  startAfter: jest.fn().mockReturnThis(),
  get: jest.fn().mockResolvedValue('page'),
  onSnapshot: mockOnSnapshot,
  doc: jest.fn(() => ({update: mockUpdate})),
};
const mockSubcollection = jest.fn(() => mockQuery);
const mockUserDoc = jest.fn(() => ({collection: mockSubcollection}));
let mockUser: {uid: string} | null = {uid: 'owner'};
jest.mock('../src/lib/firebase', () => ({
  auth: () => ({currentUser: mockUser}),
  firestore: () => ({collection: () => ({doc: mockUserDoc})}),
}));
beforeEach(() => {
  jest.clearAllMocks();
  mockUser = {uid: 'owner'};
});
test('본인 알림의 읽음 필드만 갱신한다', async () => {
  await markNotificationRead('notification-1');
  expect(mockUserDoc).toHaveBeenCalledWith('owner');
  expect(mockSubcollection).toHaveBeenCalledWith('notifications');
  expect(mockQuery.doc).toHaveBeenCalledWith('notification-1');
  expect(mockUpdate).toHaveBeenCalledWith({is_read: true});
});
test('잘못된 경로나 미인증 요청은 쓰지 않는다', async () => {
  await expect(markNotificationRead('another/path')).rejects.toThrow();
  mockUser = null;
  await expect(markNotificationRead('id')).rejects.toThrow('로그인');
  expect(mockUpdate).not.toHaveBeenCalled();
});
test('이전 페이지는 문서 커서를 기준으로 가져온다', async () => {
  const cursor = {id: 'last'} as FirebaseFirestoreTypes.QueryDocumentSnapshot;
  await expect(fetchEarlierNotifications(cursor)).resolves.toBe('page');
  expect(mockQuery.startAfter).toHaveBeenCalledWith(cursor);
  expect(mockQuery.limit).toHaveBeenCalledWith(20);
});
test('안 읽은 알림 표시는 전체 알림 중 존재 여부로 결정한다', () => {
  const onChange = jest.fn();
  subscribeUnreadNotifications(onChange);
  expect(mockQuery.where).toHaveBeenCalledWith('is_read', '==', false);
  const callback = mockOnSnapshot.mock.calls[0][0];
  callback({empty: false});
  callback({empty: true});
  expect(onChange.mock.calls).toEqual([[true], [false]]);
});
