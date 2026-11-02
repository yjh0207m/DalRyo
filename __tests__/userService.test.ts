import { completeOnboarding, isUserIdTaken } from '../src/services/user.service';
import type { OnboardingProfileInput } from '../src/types/user.types';

const mockSet = jest.fn();
const mockGetByPath: Record<string, { exists: () => boolean; data?: () => unknown }> = {};
const mockAuth: { currentUser: { uid: string; email: null; phoneNumber: null } | null } = {
  currentUser: { uid: 'u1', email: null, phoneNumber: null },
};
const ref = (path: string): { path: string; collection: (name: string) => unknown } => ({
  path,
  collection: (name: string) => ({ doc: (id: string) => ref(`${path}/${name}/${id}`) }),
});
const mockDb = {
  collection: (name: string) => ({
    doc: (id: string) => ({
      ...ref(`${name}/${id}`),
      get: async () => mockGetByPath[`${name}/${id}`] ?? { exists: () => false },
    }),
  }),
  runTransaction: async (run: (tx: unknown) => Promise<unknown>) =>
    run({
      get: async (target: { path: string }) =>
        mockGetByPath[target.path] ?? { exists: () => false },
      set: (...args: unknown[]) => mockSet(...args),
    }),
};
jest.mock('../src/lib/firebase', () => ({
  auth: () => mockAuth,
  firestore: () => mockDb,
}));
jest.mock('@react-native-firebase/firestore', () => ({
  __esModule: true,
  default: { FieldValue: { serverTimestamp: () => 'server-time' } },
}));
jest.mock('../src/services/character.service', () => ({
  buildInitialCharacter: () => ({ stage: 'egg' }),
}));

const input: OnboardingProfileInput = {
  displayName: '달리너',
  userId: '@Run_Kim',
  petName: '달료',
  gender: null,
  region: '경기',
  dialect: 'std',
};

beforeEach(() => {
  jest.clearAllMocks();
  for (const key of Object.keys(mockGetByPath)) delete mockGetByPath[key];
  mockAuth.currentUser = { uid: 'u1', email: null, phoneNumber: null };
});

describe('signing up with an id', () => {
  test('claims the id and saves it on the new user in the same transaction', async () => {
    await completeOnboarding(input, 'duck');
    const paths = mockSet.mock.calls.map(call => call[0].path);
    expect(paths).toContain('handles/run_kim');
    expect(paths).toContain('users/u1');
    const handle = mockSet.mock.calls.find(c => c[0].path === 'handles/run_kim')!;
    expect(handle[1]).toEqual({ uid: 'u1', created_at: 'server-time' });
    const user = mockSet.mock.calls.find(c => c[0].path === 'users/u1')!;
    expect(user[1].user_id).toBe('run_kim');
  });

  test('stops when somebody else already has that id, and writes nothing', async () => {
    mockGetByPath['handles/run_kim'] = { exists: () => true };
    await expect(completeOnboarding(input, 'duck')).rejects.toThrow(
      '이미 사용 중인 아이디',
    );
    expect(mockSet).not.toHaveBeenCalled();
  });

  test('refuses a badly formed id before touching the database', async () => {
    await expect(
      completeOnboarding({ ...input, userId: 'a b' }, 'duck'),
    ).rejects.toThrow('아이디');
    expect(mockSet).not.toHaveBeenCalled();
  });

  test('retrying after the profile already exists does not claim the id again', async () => {
    mockGetByPath['users/u1'] = {
      exists: () => true,
      data: () => ({ pet_name: '달료', user_id: 'run_kim' }),
    };
    mockGetByPath['users/u1/character/u1'] = {
      exists: () => true,
      data: () => ({ stage: 'egg' }),
    };
    await completeOnboarding(input, 'duck');
    expect(mockSet).not.toHaveBeenCalled();
  });
});

describe('checking whether an id is taken', () => {
  test('looks the id up after cleaning it', async () => {
    expect(await isUserIdTaken('@Run_Kim')).toBe(false);
    mockGetByPath['handles/run_kim'] = { exists: () => true };
    expect(await isUserIdTaken('  RUN_KIM ')).toBe(true);
  });
});
