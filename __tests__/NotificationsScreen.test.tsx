import React from 'react';
import { Alert, View as MockView } from 'react-native';
import Renderer, { act } from 'react-test-renderer';
import { NotificationsScreen } from '../src/screens/profile/NotificationsScreen';
import {
  resetBackgroundTasks,
  useBackgroundToasts,
  type BackgroundToast,
} from '../src/services/backgroundTask.service';

const mockMarkRead = jest.fn();
const mockSetRead = jest.fn();
const item = {
  id: 'n1',
  type: 'growth',
  is_read: false,
  title: '성장',
  body: '캐릭터가 자랐어요',
  created_at: null,
};
jest.mock('../src/services/notification.service', () => ({
  markNotificationRead: (...args: unknown[]) => mockMarkRead(...args),
}));
jest.mock('../src/hooks/useNotifications', () => ({
  useNotifications: () => ({
    items: [item],
    status: 'success',
    retry: jest.fn(),
    loadMore: jest.fn(),
    loadingMore: false,
    moreError: false,
    hasMore: false,
    setRead: (...args: unknown[]) => mockSetRead(...args),
  }),
}));
jest.mock('../src/locales/DialectProvider', () => ({
  useDialect: () => (key: string) => key,
}));
jest.mock('../src/utils/notifications', () => ({
  describeNotification: () => ({ title: '성장', body: '캐릭터가 자랐어요' }),
  notificationTime: () => null,
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: MockView,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
}));
jest.mock(
  'lucide-react-native',
  () => new Proxy({}, { get: () => () => null }),
);

let tree: Renderer.ReactTestRenderer;
let probe: Renderer.ReactTestRenderer;
let toasts: BackgroundToast[] = [];
let alert: jest.SpyInstance;
function Probe() {
  toasts = useBackgroundToasts();
  return null;
}
const open = () =>
  act(async () => {
    tree.root
      .findAll(
        node =>
          typeof node.props.onPress === 'function' &&
          node.props.accessibilityRole === 'button' &&
          String(node.props.accessibilityLabel).includes('성장'),
      )[0]
      .props.onPress();
  });

beforeEach(async () => {
  jest.clearAllMocks();
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  await act(async () => {
    probe = Renderer.create(<Probe />);
    tree = Renderer.create(<NotificationsScreen onBack={jest.fn()} />);
  });
});
afterEach(async () => {
  alert.mockRestore();
  await act(async () => {
    resetBackgroundTasks();
    tree.unmount();
    probe.unmount();
  });
});

test('opening an unread notification shows it at once; marking it read is sent in the background', async () => {
  mockMarkRead.mockReturnValue(new Promise(() => {}));
  await open();
  expect(alert).toHaveBeenCalledWith('성장', '캐릭터가 자랐어요', [
    { text: '확인' },
  ]);
  expect(mockSetRead).toHaveBeenCalledWith('n1');
  expect(mockMarkRead).toHaveBeenCalledWith('n1');
  expect(toasts).toEqual([]);
});

test('if marking it read fails, the notification still opened and only a small popup says so', async () => {
  mockMarkRead.mockRejectedValue(new Error('연결 오류'));
  await open();
  expect(alert).toHaveBeenCalledTimes(1);
  expect(toasts).toMatchObject([
    { kind: 'failed', message: '알림을 읽음으로 표시하지 못했어요' },
  ]);
});

test('an already read notification does not send anything', async () => {
  item.is_read = true;
  try {
    await open();
    expect(mockMarkRead).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledTimes(1);
  } finally {
    item.is_read = false;
  }
});
