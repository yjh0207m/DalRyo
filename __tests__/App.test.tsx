import React from 'react';
import { Text as MockText } from 'react-native';
import Renderer, { act } from 'react-test-renderer';
import App from '../App';
const mockFetchUser = jest.fn();
const mockFetchProfile = jest.fn();
const mockSubscribe = jest.fn((..._args: unknown[]) => jest.fn());
let mockListener: (user: { uid: string } | null) => void;
const mockAuth: {
  currentUser: { uid: string } | null;
  onAuthStateChanged: jest.Mock;
} = {
  currentUser: { uid: 'test' },
  onAuthStateChanged: jest.fn(listener => {
    mockListener = listener;
    return jest.fn();
  }),
};
jest.mock('@react-native-firebase/auth', () => ({
  __esModule: true,
  default: () => mockAuth,
}));
jest.mock('../src/services/user.service', () => ({
  fetchCurrentUserDocument: () => mockFetchUser(),
}));
jest.mock('../src/services/profile.service', () => ({
  fetchMyProfile: () => mockFetchProfile(),
  subscribeMyProfile: (...args: unknown[]) => mockSubscribe(...args),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  SafeAreaView: require('react-native').View,
}));
jest.mock('../src/screens/auth/SplashScreen', () => ({
  AuthStartScreen: ({ onStart }: { onStart: () => void }) => (
    <MockText onPress={onStart}>시작하기</MockText>
  ),
}));
jest.mock('../src/screens/auth/LoginScreen', () => ({
  PhoneLoginScreen: ({ onBack }: { onBack: () => void }) => (
    <>
      <MockText onPress={onBack}>인증 뒤로</MockText>
      <MockText>전화 인증</MockText>
    </>
  ),
}));
jest.mock('../src/screens/auth/OnboardingScreen', () => ({
  OnboardingScreen: () => <MockText>새 계정 등록</MockText>,
}));
jest.mock('../src/screens/main/MainAppScreen', () => ({
  MainAppScreen: () => <MockText>내 앱</MockText>,
}));
let tree: Renderer.ReactTestRenderer;
beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.currentUser = { uid: 'test' };
  mockFetchUser.mockResolvedValue({ uid: 'test' });
  mockFetchProfile.mockResolvedValue({
    user: { uid: 'test', dialect: 'std' },
    character: null,
  });
});
afterEach(async () => {
  if (tree) await act(() => tree.unmount());
});
async function renderUser(user: { uid: string } | null) {
  await act(() => {
    tree = Renderer.create(<App />);
  });
  await notifyAuth(user);
}
async function notifyAuth(user: { uid: string } | null) {
  mockAuth.currentUser = user;
  await act(async () => {
    mockListener(user);
  });
}
async function pressStart() {
  await act(async () => {
    tree.root
      .findAllByType(MockText)
      .find(n => n.props.children === '시작하기')!
      .props.onPress();
  });
}
function renderedText() {
  return JSON.stringify(tree.toJSON());
}
test('signed-in accounts skip the first screen and go to preparation, then home', async () => {
  let resolve!: (value: unknown) => void;
  mockFetchUser.mockReturnValue(
    new Promise(done => {
      resolve = done;
    }),
  );
  await renderUser({ uid: 'test' });
  expect(renderedText()).not.toContain('시작하기');
  expect(renderedText()).toContain('달료 준비 중');
  expect(mockSubscribe).not.toHaveBeenCalled();
  await act(async () => resolve({ uid: 'test' }));
  expect(renderedText()).toContain('내 앱');
  expect(mockSubscribe).toHaveBeenCalledTimes(1);
});
test('profile read failure offers retry without registering an existing account', async () => {
  mockFetchUser.mockRejectedValueOnce(new Error('offline'));
  await renderUser({ uid: 'test' });
  expect(renderedText()).not.toContain('시작하기');
  expect(renderedText()).toContain('다시 시도');
  expect(renderedText()).not.toContain('새 계정 등록');
  await act(async () => tree.root.findAll(node => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function')[0].props.onPress());
  expect(renderedText()).toContain('내 앱');
});
test('only a confirmed missing user document opens registration', async () => {
  mockFetchUser.mockResolvedValue(null);
  await renderUser({ uid: 'test' });
  expect(renderedText()).not.toContain('시작하기');
  expect(renderedText()).toContain('새 계정 등록');
});
test('signed-out accounts see first screen, then phone verification', async () => {
  await renderUser(null);
  expect(renderedText()).toContain('시작하기');
  await pressStart();
  expect(renderedText()).toContain('전화 인증');
  expect(mockFetchUser).not.toHaveBeenCalled();
});

test('the first screen is not shown while the saved login is being restored', async () => {
  await act(() => {
    tree = Renderer.create(<App />);
  });
  expect(renderedText()).toContain('달료 준비 중');
  expect(renderedText()).not.toContain('시작하기');
  expect(renderedText()).not.toContain('전화 인증');
  await notifyAuth({ uid: 'test' });
  expect(renderedText()).toContain('내 앱');
});

test('returning from verification allows Start to work again and login completion opens home', async () => {
  await renderUser(null);
  await pressStart();
  await act(() =>
    tree.root
      .findAllByType(MockText)
      .find(n => n.props.children === '인증 뒤로')!
      .props.onPress(),
  );
  expect(renderedText()).toContain('시작하기');
  await pressStart();
  expect(renderedText()).toContain('전화 인증');
  await notifyAuth({ uid: 'test' });
  expect(renderedText()).toContain('내 앱');
});

test('logout invalidates an in-flight profile response and returns to the first screen', async () => {
  let resolve!: (value: unknown) => void;
  mockFetchProfile.mockReturnValue(
    new Promise(done => {
      resolve = done;
    }),
  );
  await renderUser({ uid: 'test' });
  await notifyAuth(null);
  await act(async () => resolve({ user: { uid: 'test' }, character: null }));
  expect(renderedText()).toContain('시작하기');
  expect(renderedText()).not.toContain('내 앱');
  await pressStart();
  expect(renderedText()).toContain('전화 인증');
});

test('after logging out of the home screen, the first screen shows and Start leads to phone verification', async () => {
  await renderUser({ uid: 'test' });
  expect(renderedText()).toContain('내 앱');
  await notifyAuth(null);
  expect(renderedText()).toContain('시작하기');
  await pressStart();
  expect(renderedText()).toContain('전화 인증');
});

test('reopening the app with a saved login goes straight to home', async () => {
  await renderUser({ uid: 'test' });
  expect(renderedText()).toContain('내 앱');
  await act(() => tree.unmount());
  await renderUser({ uid: 'test' });
  expect(renderedText()).toContain('내 앱');
  expect(renderedText()).not.toContain('시작하기');
});
