import {updateMyProfile} from '../src/services/profile.service';
import {signOut} from '../src/services/auth.service';
import type {ProfileForm} from '../src/utils/profile';

const mockUpdate = jest.fn().mockResolvedValue(undefined);
const mockSignOut = jest.fn().mockResolvedValue(undefined);
const mockDeleteToken = jest.fn().mockResolvedValue(undefined);
const mockAuth: {currentUser: {uid: string} | null; signOut: typeof mockSignOut} = {currentUser: {uid: 'test-user'}, signOut: mockSignOut};
const mockDoc = jest.fn(() => ({update: mockUpdate}));
const mockCollection = jest.fn(() => ({doc: mockDoc}));
jest.mock('../src/lib/firebase', () => ({auth: () => mockAuth, firestore: () => ({collection: mockCollection}), messaging: () => ({deleteToken: mockDeleteToken})}));
jest.mock('@react-native-firebase/firestore', () => ({__esModule: true, default: {FieldValue: {serverTimestamp: () => 'server-time'}}}));

const form: ProfileForm = {displayName: 'runner', website: '', height: '170', weight: '60', gender: null, region: '경기', dialect: 'std'};
beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.currentUser = {uid: 'test-user'};
});

test('본인 프로필의 편집 가능한 필드만 갱신한다', async () => {
  await updateMyProfile(form);
  expect(mockCollection).toHaveBeenCalledWith('users');
  expect(mockDoc).toHaveBeenCalledWith('test-user');
  expect(mockUpdate).toHaveBeenCalledWith({
    display_name: 'runner',
    website: null,
    height_cm: 170,
    weight_kg: 60,
    gender: null,
    region: '경기',
    dialect: 'std',
    updated_at: 'server-time',
  });
});
test('로그인하지 않았거나 검증에 실패하면 쓰지 않는다', async () => {
  mockAuth.currentUser = null;
  await expect(updateMyProfile(form)).rejects.toThrow('로그인');
  mockAuth.currentUser = {uid: 'test-user'};
  await expect(updateMyProfile({...form, weight: '-1'})).rejects.toThrow('몸무게');
  expect(mockUpdate).not.toHaveBeenCalled();
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
