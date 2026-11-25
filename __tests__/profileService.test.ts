import {signOut} from '../src/services/auth.service';

const mockUpdate = jest.fn().mockResolvedValue(undefined);
const mockSignOut = jest.fn().mockResolvedValue(undefined);
const mockDeleteToken = jest.fn().mockResolvedValue(undefined);
const mockAuth: {currentUser: {uid: string} | null; signOut: typeof mockSignOut} = {currentUser: {uid: 'test-user'}, signOut: mockSignOut};
const mockDoc = jest.fn(() => ({update: mockUpdate}));
const mockCollection = jest.fn(() => ({doc: mockDoc}));
jest.mock('../src/lib/firebase', () => ({auth: () => mockAuth, firestore: () => ({collection: mockCollection}), messaging: () => ({deleteToken: mockDeleteToken})}));

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.currentUser = {uid: 'test-user'};
});

test('로그아웃 전에 기기 알림 토큰을 계정에서 분리한다', async () => {
  await signOut();
  expect(mockUpdate).toHaveBeenCalledWith({fcm_token:null});
  expect(mockDeleteToken).toHaveBeenCalledTimes(1);
  expect(mockSignOut).toHaveBeenCalledTimes(1);
});
test('계정 토큰 분리에 실패하면 다른 계정으로 넘어가지 않는다', async () => {
  mockUpdate.mockRejectedValueOnce(new Error('offline'));
  await expect(signOut()).rejects.toThrow('offline');
  expect(mockSignOut).not.toHaveBeenCalled();
});
