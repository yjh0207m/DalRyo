import React from 'react';
jest.mock('../src/hooks/usePostAuthor', () => ({ usePostAuthor: jest.fn() }));
jest.mock('../src/components/character/CharacterView', () => ({
  CharacterView: () => null,
}));
import { Switch, Text, TextInput, View as MockView } from 'react-native';
import Renderer, { act } from 'react-test-renderer';
import { Composer } from '../src/screens/community/CommunityScreen';
import { PhotoSourceSheet } from '../src/components/ui';
import { resetBackgroundTasks } from '../src/services/backgroundTask.service';

const mockAction = jest.fn(),
  mockUpload = jest.fn(),
  mockChoosePhoto = jest.fn(),
  mockMonthlyRuns = jest.fn(),
  mockDistrict = jest.fn(),
  mockRegion = jest.fn(),
  mockFriends = jest.fn();
jest.mock('../src/services/social.service', () => ({
  myUid: () => 'me',
  newSocialId: () => 'new-post',
  socialRequest: (...args: unknown[]) => mockAction(...args),
  socialError: (error: Error) => error.message,
  myRegion: () => mockRegion(),
  fetchFriends: () => mockFriends(),
}));
jest.mock('../src/services/media.service', () => ({
  choosePhoto: (...args: unknown[]) => mockChoosePhoto(...args),
  uploadPhoto: (...args: unknown[]) => mockUpload(...args),
}));
jest.mock('../src/services/run.service', () => ({
  fetchMonthlyRuns: (...args: unknown[]) => mockMonthlyRuns(...args),
  getRunStartedAtDate: (run: { started_at: { toDate: () => Date } }) =>
    run.started_at.toDate(),
}));
jest.mock('../src/services/runLocation.service', () => ({
  fetchRunDistrict: (...args: unknown[]) => mockDistrict(...args),
}));
jest.mock('../src/hooks/useServerFeed', () => ({ useServerFeed: jest.fn() }));
jest.mock('../src/hooks/useComments', () => ({ useComments: jest.fn() }));
jest.mock('../src/services/chat.service', () => ({
  watchConversations: () => () => {},
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: MockView,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
}));
jest.mock(
  'lucide-react-native',
  () => new Proxy({}, { get: () => () => null }),
);

const today = new Date();
const started = new Date(
  today.getFullYear(),
  today.getMonth(),
  today.getDate(),
  7,
  30,
);
const run = {
  run_id: 'run-1',
  uid: 'me',
  distance_km: 5.2,
  duration_sec: 1800,
  avg_pace_sec: 346,
  calories: 320,
  route: [{ lat: 37.5, lng: 127.03, timestamp: 1 }],
  started_at: { toDate: () => started },
};

let tree: Renderer.ReactTestRenderer;
let onSaved: jest.Mock;
beforeEach(() => {
  jest.clearAllMocks();
  mockAction.mockResolvedValue({});
  mockUpload.mockResolvedValue({ url: 'https://storage.example/p.jpg' });
  mockMonthlyRuns.mockResolvedValue([run]);
  mockDistrict.mockResolvedValue('서울 강남구');
  mockRegion.mockResolvedValue('경기 수원시');
  mockFriends.mockResolvedValue([
    { uid: 'friend-a', display_name: '가람', profile_image: null },
    { uid: 'friend-b', display_name: '나래', profile_image: null },
  ]);
  onSaved = jest.fn();
});
afterEach(async () => {
  await act(async () => {
    resetBackgroundTasks();
    tree?.unmount();
  });
});

async function render() {
  await act(async () => {
    tree = Renderer.create(<Composer onBack={jest.fn()} onSaved={onSaved} />);
  });
}
const byLabel = (label: string) =>
  tree.root.findAll(
    node =>
      typeof node.props.onPress === 'function' &&
      node.props.accessibilityLabel === label,
  )[0];
async function press(label: string) {
  const target = byLabel(label);
  if (!target) throw new Error(`no button: ${label}`);
  await act(async () => target.props.onPress());
}
async function pressTestID(id: string) {
  const target = tree.root.findAll(
    node =>
      node.props.testID === id && typeof node.props.onPress === 'function',
  )[0];
  if (!target) throw new Error(`no element: ${id}`);
  await act(async () => target.props.onPress());
}
const buttonByText = (label: string) => {
  const text = tree.root.findAll(node => node.props.children === label)[0];
  let node: Renderer.ReactTestInstance | null = text;
  while (node && typeof node.props.onPress !== 'function') node = node.parent;
  return node!;
};
const texts = () =>
  tree.root
    .findAllByType(Text)
    .map(node => ([] as unknown[]).concat(node.props.children).join(''));
const has = (id: string) =>
  tree.root.findAll(node => node.props.testID === id).length > 0;
const type = (label: string, value: string) =>
  act(async () =>
    tree.root
      .findAllByType(TextInput)
      .find(input => input.props.accessibilityLabel === label)!
      .props.onChangeText(value),
  );
async function attachRun() {
  await press('달리기 기록 첨부');
  expect(has('run-picker-sheet')).toBe(true);
  await pressTestID(`run-picker-day-${today.getDate()}`);
  await pressTestID('run-picker-run-run-1');
}
async function post() {
  await act(async () => buttonByText('게시물 올리기').props.onPress());
}

test('the composer starts by asking for a photo or a run record, in that order of sections', async () => {
  await render();
  const headers = tree.root
    .findAllByType(Text)
    .filter(node => node.props.accessibilityRole === 'header')
    .map(node => String(node.props.children));
  expect(headers).toEqual([
    '오늘의 달리기',
    '사진 또는 달리기 기록',
    '내용',
    '태그',
    '공개 범위',
    '함께 달린 사람',
  ]);
  expect(byLabel('사진 첨부')).toBeDefined();
  expect(byLabel('달리기 기록 첨부')).toBeDefined();
  expect(buttonByText('게시물 올리기').props.disabled).toBe(true);
});

test('attaching a run opens a calendar sheet, a day shows its runs and picking one attaches it', async () => {
  await render();
  await press('달리기 기록 첨부');
  expect(mockMonthlyRuns).toHaveBeenCalledWith(
    today.getFullYear(),
    today.getMonth(),
  );
  // 날짜를 고르기 전에는 안내만 있다
  expect(texts()).toContain('날짜를 고르면 그날 달린 기록이 나와요.');
  // 아직 오지 않은 달로는 넘어갈 수 없다
  expect(byLabel('다음 달').props.disabled).toBe(true);
  await pressTestID(`run-picker-day-${today.getDate()}`);
  expect(texts()).toContain('5.20km');
  await pressTestID('run-picker-run-run-1');
  // 시트가 내려가고 첨부한 기록이 보인다
  expect(has('run-picker-sheet')).toBe(false);
  expect(has('composer-attached-run')).toBe(true);
  expect(buttonByText('게시물 올리기').props.disabled).toBe(false);
  await type('게시물 내용', '아침 러닝');
  await post();
  expect(mockUpload).not.toHaveBeenCalled();
  expect(mockAction).toHaveBeenCalledWith('createPost', {
    postId: 'new-post',
    text: '아침 러닝',
    visibility: 'public',
    imageUrl: null,
    runId: 'run-1',
    withUids: [],
  });
  expect(onSaved).toHaveBeenCalledWith('public');
});

test('a day without runs says so and can not attach anything', async () => {
  mockMonthlyRuns.mockResolvedValue([]);
  await render();
  await press('달리기 기록 첨부');
  expect(texts()).toContain('이 달에는 달린 기록이 없어요.');
  await press('이전 달');
  const previous = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  expect(mockMonthlyRuns).toHaveBeenLastCalledWith(
    previous.getFullYear(),
    previous.getMonth(),
  );
  await pressTestID('run-picker-day-1');
  expect(texts()).toContain(
    `${previous.getMonth() + 1}월 1일에는 달린 기록이 없어요.`,
  );
});

test('a photo and a run record replace each other', async () => {
  mockChoosePhoto.mockResolvedValue({ uri: 'file:///p.jpg' });
  await render();
  await attachRun();
  expect(has('composer-attached-run')).toBe(true);
  await act(async () => tree.root.findByType(PhotoSourceSheet).props.onAlbum());
  expect(has('composer-attached-run')).toBe(false);
  await post();
  expect(mockAction).toHaveBeenCalledWith(
    'createPost',
    expect.objectContaining({
      imageUrl: 'https://storage.example/p.jpg',
      runId: null,
    }),
  );
});

test('content and tags are typed separately and joined with the shared location', async () => {
  await render();
  await attachRun();
  await type('게시물 내용', '  한강 10km  ');
  await type('태그', '오운완, 달료런 #오운완');
  const location = tree.root
    .findAllByType(Switch)
    .find(node => node.props.accessibilityLabel === '위치 공유')!;
  // 위치 공유는 기본으로 꺼져 있고, 첨부한 기록의 출발 지점(시·구)을 쓴다
  expect(location.props.value).toBe(false);
  expect(texts().join('|')).toContain('서울 강남구');
  expect(mockDistrict).toHaveBeenCalledWith(run);
  await act(async () => location.props.onValueChange(true));
  await press('팔로워 공개');
  await post();
  expect(mockAction).toHaveBeenCalledWith('createPost', {
    postId: 'new-post',
    text: '한강 10km\n📍 서울 강남구\n#오운완 #달료런',
    visibility: 'followers',
    imageUrl: null,
    runId: 'run-1',
    withUids: [],
  });
});

test('without a run the location falls back to the profile region', async () => {
  mockChoosePhoto.mockResolvedValue({ uri: 'file:///p.jpg' });
  await render();
  expect(texts().join('|')).toContain('경기 수원시');
  expect(mockDistrict).not.toHaveBeenCalled();
});

test('a profile region saved as a province only is too broad, and says how to fix it', async () => {
  mockRegion.mockResolvedValue('경기');
  await render();
  const location = tree.root
    .findAllByType(Switch)
    .find(node => node.props.accessibilityLabel === '위치 공유')!;
  expect(location.props.disabled).toBe(true);
  expect(texts()).toContain(
    '설정 > 내 지역을 시·구까지 고르면 공유할 수 있어요',
  );
});

test('friends who ran together are picked in a sheet and sent as tags', async () => {
  await render();
  await attachRun();
  await press('함께 달린 사람 태그');
  expect(has('runner-tag-sheet')).toBe(true);
  await press('가람');
  await press('나래');
  await press('나래');
  await act(async () => buttonByText('1명 태그하기').props.onPress());
  expect(has('runner-tag-sheet')).toBe(false);
  expect(texts()).toContain('가람');
  await press('함께 달린 사람 태그');
  await press('나래');
  await act(async () => buttonByText('2명 태그하기').props.onPress());
  await press('가람 태그 빼기');
  await post();
  expect(mockAction).toHaveBeenCalledWith(
    'createPost',
    expect.objectContaining({ withUids: ['friend-b'] }),
  );
});

test('with no mutual friends the tag sheet explains why it is empty', async () => {
  mockFriends.mockResolvedValue([]);
  await render();
  await press('함께 달린 사람 태그');
  expect(texts()).toContain('아직 서로 팔로우하는 친구가 없어요.');
});
