import React from 'react';
import {
  Alert,
  Modal,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import Renderer, { act } from 'react-test-renderer';
import { ShareStudioScreen } from '../src/screens/run/ShareStudioScreen';
import {
  resetBackgroundTasks,
  retryBackgroundTask,
  useBackgroundToasts,
  type BackgroundToast,
} from '../src/services/backgroundTask.service';
import type { RunDocument } from '../src/types/run.types';

const mockCapture = jest.fn();
const mockRelease = jest.fn();
const mockChoosePhoto = jest.fn();
const mockUpload = jest.fn();
const mockSocialRequest = jest.fn();
const mockDistrict = jest.fn();
const mockUserDoc = jest.fn();
const mockNativeShare = jest.fn();
jest.mock('lucide-react-native', () => ({
  Camera: () => null,
  ChevronLeft: () => null,
  Image: () => null,
  Share2: () => null,
  Trash2: () => null,
}));
jest.mock('react-native-share', () => ({
  __esModule: true,
  default: { open: (...args: unknown[]) => mockNativeShare(...args) },
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: require('react-native').View,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('react-native-view-shot', () => ({
  captureRef: (...args: unknown[]) => mockCapture(...args),
  releaseCapture: (...args: unknown[]) => mockRelease(...args),
}));
jest.mock('../src/services/character.service', () => ({
  fetchCharacterImageUrl: jest.fn(),
}));
jest.mock('../src/services/runLocation.service', () => ({
  fetchRunDistrict: (...args: unknown[]) => mockDistrict(...args),
}));
jest.mock('../src/services/user.service', () => ({
  fetchCurrentUserDocument: () => mockUserDoc(),
}));
jest.mock('../src/services/media.service', () => ({
  choosePhoto: (...args: unknown[]) => mockChoosePhoto(...args),
  uploadPhoto: (...args: unknown[]) => mockUpload(...args),
}));
jest.mock('../src/services/social.service', () => ({
  newSocialId: () => 'post-1',
  socialError: (error: unknown) =>
    error instanceof Error ? error.message : '처리하지 못했어요.',
  socialRequest: (...args: unknown[]) => mockSocialRequest(...args),
}));

const run = {
  run_id: 'run-1',
  distance_km: 5,
  duration_sec: 1500,
  avg_pace_sec: 300,
  calories: 300,
  route: [{ lat: 37.5, lng: 127.0, timestamp: 1 }],
} as unknown as RunDocument;
let tree: Renderer.ReactTestRenderer;
let probe: Renderer.ReactTestRenderer;
let toasts: BackgroundToast[] = [];
let alert: jest.SpyInstance;
function Probe() {
  toasts = useBackgroundToasts();
  return null;
}
async function render(
  options: { onPosted?: () => void; run?: RunDocument } = {},
) {
  await act(async () => {
    tree = Renderer.create(
      <ShareStudioScreen
        character={null}
        run={options.run ?? run}
        onBack={jest.fn()}
        onPosted={options.onPosted}
      />,
    );
  });
}
function pressable(label: string) {
  let node: Renderer.ReactTestInstance | null =
    tree.root.findAllByType(Text).find(text => text.props.children === label) ??
    null;
  while (node && typeof node.props.onPress !== 'function') node = node.parent;
  if (!node) throw new Error(`no pressable for ${label}`);
  return node;
}
const press = (label: string) =>
  act(async () => pressable(label).props.onPress());
const flush = () => act(async () => {});
const labels = () =>
  tree.root.findAllByType(Text).map(node => node.props.children);
const locationSwitch = () => tree.root.findByType(Switch);
const input = (label: string) =>
  tree.root
    .findAllByType(TextInput)
    .find(node => node.props.accessibilityLabel === label)!;
const write = (label: string, value: string) =>
  act(async () => input(label).props.onChangeText(value));
const createPostInput = () =>
  mockSocialRequest.mock.calls.find(call => call[0] === 'createPost')![1];
// 공유·게시용으로 캡처되는 카드 View(4:5)
const capturedCard = () => {
  const [card] = tree.root.findAll(
    node =>
      node.type === View &&
      node.props.collapsable === false &&
      StyleSheet.flatten(node.props.style)?.aspectRatio === 4 / 5,
  );
  return card;
};
const cameraButton = (root: Renderer.ReactTestInstance) =>
  root.findAll(
    node =>
      node.props.accessibilityLabel === '사진 추가' &&
      typeof node.props.onPress === 'function',
  );
const shareButton = () =>
  tree.root.findAll(
    node =>
      node.props.accessibilityLabel === '이미지 공유' &&
      typeof node.props.onPress === 'function',
  )[0];

beforeEach(async () => {
  jest.clearAllMocks();
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  mockCapture.mockResolvedValue('/tmp/card.jpg');
  mockUpload.mockResolvedValue({
    url: 'https://storage.example/posts/u/card.jpg',
    discard: jest.fn(),
  });
  mockSocialRequest.mockResolvedValue({ postId: 'post-1' });
  mockDistrict.mockResolvedValue('서울특별시 강남구');
  mockUserDoc.mockResolvedValue({ region: '서울' });
  mockNativeShare.mockResolvedValue({});
  await act(async () => {
    probe = Renderer.create(<Probe />);
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

test('the camera button sits in the phone frame below the card, outside the captured card view', async () => {
  await render();
  const card = capturedCard();
  expect(cameraButton(tree.root)).toHaveLength(1);
  expect(cameraButton(card)).toHaveLength(0);
  expect(labels()).not.toContain('앨범');
  expect(labels()).not.toContain('사진 지우기');
});

test('the card keeps its original layout: stats at the bottom and square corners so a jpg has no black corners', async () => {
  await render();
  const card = capturedCard();
  expect(StyleSheet.flatten(card.props.style)).toMatchObject({
    aspectRatio: 4 / 5,
  });
  expect(StyleSheet.flatten(card.props.style).borderRadius).toBeUndefined();
  const stats = tree.root.findAll(
    node =>
      node.type === View && StyleSheet.flatten(node.props.style)?.gap === 6,
  )[0];
  expect(StyleSheet.flatten(stats.props.style).bottom).toBe(38);
});

test('the phone frame is a light color that stands out from the background', async () => {
  await render();
  const phone = tree.root.findAll(
    node =>
      node.type === View &&
      StyleSheet.flatten(node.props.style)?.borderRadius === 44,
  )[0];
  const { backgroundColor } = StyleSheet.flatten(phone.props.style);
  const [r, g, b] = [1, 3, 5].map(i =>
    parseInt(String(backgroundColor).slice(i, i + 2), 16),
  );
  expect(Math.min(r, g, b)).toBeGreaterThan(235);
});

test('the home button is raised above the phone body: brighter than the body and with a shadow', async () => {
  await render();
  const body = StyleSheet.flatten(
    tree.root.findAll(
      node =>
        node.type === View &&
        StyleSheet.flatten(node.props.style)?.borderRadius === 44,
    )[0].props.style,
  );
  const [button] = cameraButton(tree.root);
  const home = StyleSheet.flatten(button.props.style({ pressed: false }));
  const light = (hex: string) =>
    [1, 3, 5]
      .map(i => parseInt(hex.slice(i, i + 2), 16))
      .reduce((sum, value) => sum + value, 0);
  expect(light(String(home.backgroundColor))).toBeGreaterThan(
    light(String(body.backgroundColor)),
  );
  expect(home.shadowOpacity).toBeGreaterThan(0);
  expect(home.elevation).toBeGreaterThan(0);
  const pressed = StyleSheet.flatten(button.props.style({ pressed: true }));
  expect(pressed.shadowOpacity).toBeLessThan(home.shadowOpacity as number);
});

test('the camera button opens a bottom sheet to choose camera or album, then the picker opens', async () => {
  const original = Platform.OS;
  (Platform as { OS: string }).OS = 'android';
  try {
    await render();
    expect(tree.root.findByType(Modal).props.visible).toBe(false);
    await act(async () => cameraButton(tree.root)[0].props.onPress());
    expect(tree.root.findByType(Modal).props.visible).toBe(true);
    expect(labels()).toEqual(
      expect.arrayContaining(['사진 촬영', '앨범에서 선택']),
    );
    mockChoosePhoto.mockResolvedValue(null);
    await press('앨범에서 선택');
    expect(mockChoosePhoto).toHaveBeenCalledWith(false);
    expect(tree.root.findByType(Modal).props.visible).toBe(false);
    await act(async () => cameraButton(tree.root)[0].props.onPress());
    await press('사진 촬영');
    expect(mockChoosePhoto).toHaveBeenLastCalledWith(true);
  } finally {
    (Platform as { OS: string }).OS = original;
  }
});

test('location is the only disclosure setting; content and tags are plain inputs, not toggles', async () => {
  await render();
  expect(tree.root.findAllByType(Switch)).toHaveLength(1);
  expect(locationSwitch().props.accessibilityLabel).toBe('위치 공개');
  expect(input('게시물 내용')).toBeDefined();
  expect(input('태그')).toBeDefined();
});

test('content and tags start empty with only a hint, so no automatic text is written for the user', async () => {
  await render();
  expect(input('게시물 내용').props.value).toBe('');
  expect(input('태그').props.value).toBe('');
  expect(input('게시물 내용').props.placeholder).toBeTruthy();
  expect(input('게시물 내용').props.multiline).toBe(true);
  expect(input('게시물 내용').props.maxLength).toBeLessThanOrEqual(1500);
});

test('posting hands the upload to the background and leaves immediately without waiting for the server', async () => {
  const onPosted = jest.fn();
  let finish!: (value: unknown) => void;
  mockSocialRequest.mockReturnValue(
    new Promise(resolve => {
      finish = resolve;
    }),
  );
  await render({ onPosted });
  await press('피드에 게시');
  expect(mockCapture.mock.calls[0][1]).toMatchObject({
    format: 'jpg',
    result: 'tmpfile',
    width: 1080,
    height: 1350,
  });
  expect(onPosted).toHaveBeenCalledTimes(1);
  expect(alert).not.toHaveBeenCalled();
  expect(toasts).toMatchObject([
    { kind: 'running', message: '게시물 올리는 중' },
  ]);
  expect(mockUpload).toHaveBeenCalledWith(
    { uri: 'file:///tmp/card.jpg', type: 'image/jpeg' },
    'posts',
    expect.any(Function),
  );
  expect(mockRelease).not.toHaveBeenCalled();
  await act(async () => finish({ postId: 'post-1' }));
  expect(toasts).toMatchObject([
    { kind: 'done', message: '게시물을 올렸어요' },
  ]);
  expect(mockRelease).toHaveBeenCalledWith('/tmp/card.jpg');
});

test('by default the post is just the card image: no automatic text, the location private, and the run attached', async () => {
  await render();
  await press('피드에 게시');
  expect(createPostInput()).toEqual({
    postId: 'post-1',
    text: '',
    visibility: 'public',
    imageUrl: 'https://storage.example/posts/u/card.jpg',
    runId: 'run-1',
  });
  expect(labels()).toContain('피드에 올렸어요');
  expect(pressable('피드에 올렸어요').props.disabled).toBe(true);
  await press('피드에 올렸어요');
  expect(mockSocialRequest).toHaveBeenCalledTimes(1);
});

test('what the user types is what gets posted, with the tags tidied up', async () => {
  await render();
  await write('게시물 내용', '한강에서 상쾌하게 달렸어요');
  await write('태그', '러닝, 한강 #오운완 !!');
  await press('피드에 게시');
  expect(createPostInput().text).toBe(
    '한강에서 상쾌하게 달렸어요\n#러닝 #한강 #오운완',
  );
});

test('typed text that is cleared again is not posted', async () => {
  await render();
  await write('게시물 내용', '지울 내용');
  await write('태그', '#지울태그');
  await write('게시물 내용', '');
  await write('태그', '');
  await press('피드에 게시');
  expect(createPostInput()).toMatchObject({ text: '', runId: 'run-1' });
});

test('turning the location on adds the city and district only, between the content and the tags', async () => {
  await render();
  expect(mockDistrict).toHaveBeenCalledWith(run);
  expect(labels()).toContain('서울특별시 강남구');
  await act(async () => locationSwitch().props.onValueChange(true));
  await write('게시물 내용', '완주!');
  await write('태그', '#오운완');
  await press('피드에 게시');
  expect(createPostInput().text).toBe('완주!\n📍 서울특별시 강남구\n#오운완');
});

test('when the run location is unknown it falls back to the region on the profile', async () => {
  mockDistrict.mockResolvedValue(null);
  await render();
  expect(labels()).toContain('서울');
  await act(async () => locationSwitch().props.onValueChange(true));
  await press('피드에 게시');
  expect(createPostInput().text).toBe('📍 서울');
});

test('without any location information the switch is unavailable and nothing is written', async () => {
  mockDistrict.mockResolvedValue(null);
  mockUserDoc.mockResolvedValue({ region: '' });
  await render();
  expect(locationSwitch().props.disabled).toBe(true);
  expect(locationSwitch().props.value).toBe(false);
  expect(labels()).toContain('공개할 위치 정보가 없어요');
  await press('피드에 게시');
  expect(createPostInput().text).not.toContain('📍');
});

test('while the location is being looked up the switch waits', async () => {
  mockDistrict.mockReturnValue(new Promise(() => {}));
  await render();
  expect(labels()).toContain('위치를 확인하는 중이에요');
  expect(locationSwitch().props.disabled).toBe(true);
});

test('a failed upload is reported in the popup and retrying reuses the same post id and capture', async () => {
  mockSocialRequest.mockRejectedValueOnce(new Error('네트워크 오류'));
  await render();
  await press('피드에 게시');
  expect(toasts).toMatchObject([
    {
      kind: 'failed',
      message: '게시물을 올리지 못했어요',
      detail: '네트워크 오류',
      retryable: true,
    },
  ]);
  expect(mockRelease).not.toHaveBeenCalled();
  await act(async () => retryBackgroundTask(toasts[0].id));
  expect(mockSocialRequest).toHaveBeenCalledTimes(2);
  expect(mockSocialRequest.mock.calls[1][1]).toEqual(
    mockSocialRequest.mock.calls[0][1],
  );
  expect(mockRelease).toHaveBeenCalledWith('/tmp/card.jpg');
  expect(toasts).toMatchObject([{ kind: 'done' }]);
});

test('without onPosted it just stays on the screen and the popup reports the result', async () => {
  await render();
  await press('피드에 게시');
  expect(alert).not.toHaveBeenCalled();
  expect(toasts).toMatchObject([{ kind: 'done' }]);
});

test('if the card cannot be captured, nothing is posted and the screen explains why', async () => {
  const onPosted = jest.fn();
  mockCapture.mockRejectedValue(new Error('캡처 실패'));
  await render({ onPosted });
  await press('피드에 게시');
  expect(alert).toHaveBeenCalledWith('카드를 만들지 못했어요', '캡처 실패');
  expect(onPosted).not.toHaveBeenCalled();
  expect(mockSocialRequest).not.toHaveBeenCalled();
  expect(labels()).toContain('피드에 게시');
  await flush();
});

test('the image share button sits at the top right of the card screen, outside the captured card', async () => {
  await render();
  expect(shareButton()).toBeDefined();
  expect(shareButton().props.disabled).toBeFalsy();
  expect(
    capturedCard().findAll(
      node => node.props.accessibilityLabel === '이미지 공유',
    ),
  ).toHaveLength(0);
  const header = tree.root.findAll(
    node =>
      node.type === View &&
      StyleSheet.flatten(node.props.style)?.flexDirection === 'row' &&
      node.findAll(n => n.props.accessibilityLabel === '공유 카드에서 뒤로')
        .length > 0,
  )[0];
  const buttons = header
    .findAll(
      node =>
        typeof node.props.onPress === 'function' &&
        node.props.accessibilityRole === 'button',
    )
    .map(node => node.props.accessibilityLabel);
  expect(buttons).toEqual(['공유 카드에서 뒤로', '이미지 공유']);
  expect(labels()).toContain('피드에 게시');
});

test('the share button turns the card into a png and opens the share sheet without posting anything', async () => {
  await render();
  await act(async () => shareButton().props.onPress());
  expect(mockCapture.mock.calls[0][1]).toMatchObject({
    format: 'png',
    result: 'tmpfile',
    width: 1080,
    height: 1350,
  });
  expect(mockNativeShare).toHaveBeenCalledWith({
    title: '달료 오운완',
    url: 'file:///tmp/card.jpg',
    type: 'image/png',
    filename: 'dalryo-run',
    failOnCancel: false,
    useInternalStorage: true,
  });
  expect(mockRelease).toHaveBeenCalledWith('/tmp/card.jpg');
  expect(mockSocialRequest).not.toHaveBeenCalled();
  expect(mockUpload).not.toHaveBeenCalled();
  expect(toasts).toEqual([]);
});

test('if the share image cannot be made, the screen says so and stays usable', async () => {
  mockNativeShare.mockRejectedValueOnce(new Error('공유 실패'));
  await render();
  await act(async () => shareButton().props.onPress());
  expect(alert).toHaveBeenCalledWith(
    '공유 카드를 만들지 못했어요',
    '공유 실패',
  );
  expect(shareButton().props.disabled).toBeFalsy();
  expect(mockRelease).toHaveBeenCalledWith('/tmp/card.jpg');
});
