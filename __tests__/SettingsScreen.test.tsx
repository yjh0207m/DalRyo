import React from 'react';
import { Alert, Switch, Text, TextInput } from 'react-native';
import Renderer, { act } from 'react-test-renderer';
import { SettingsScreen } from '../src/screens/profile/SettingsScreen';
import type { UserDocument } from '../src/types/user.types';

const mockSave = jest.fn();
const mockSignOut = jest.fn();
const mockPush = jest.fn();
const mockChoose = jest.fn();
const mockUpload = jest.fn();
jest.mock(
  'lucide-react-native',
  () => new Proxy({}, { get: () => () => null }),
);
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: require('react-native').View,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../src/services/account.service', () => ({
  saveAccount: (...args: unknown[]) => mockSave(...args),
}));
jest.mock('../src/services/auth.service', () => ({
  signOut: () => mockSignOut(),
}));
jest.mock('../src/services/notification.service', () => ({
  requestPushPermission: () => mockPush(),
}));
jest.mock('../src/services/media.service', () => ({
  choosePhoto: (...args: unknown[]) => mockChoose(...args),
  uploadPhoto: (...args: unknown[]) => mockUpload(...args),
}));

const user = {
  uid: 'u1',
  display_name: '조현',
  pet_name: '달료',
  profile_image: null,
  website: null,
  height_cm: 170,
  weight_kg: 60,
  gender: 'female',
  region: '서울',
  dialect: 'std',
  notification_settings: {
    push: false,
    growth: true,
    social: true,
    stone: true,
  },
} as unknown as UserDocument;
const onBack = jest.fn();
let tree: Renderer.ReactTestRenderer;
let alert: jest.SpyInstance;
async function render(onPreviewCharacter?: () => void) {
  await act(async () => {
    tree = Renderer.create(
      <SettingsScreen
        user={user}
        onBack={onBack}
        onPreviewCharacter={onPreviewCharacter}
      />,
    );
  });
}
const joined = (children: unknown) =>
  ([] as unknown[]).concat(children).join('');
const texts = () =>
  tree.root.findAllByType(Text).map(node => joined(node.props.children));
const byLabel = (label: string) =>
  tree.root.findAll(
    node =>
      node.props.accessibilityLabel === label &&
      typeof node.props.onPress === 'function',
  )[0];
const press = (label: string) =>
  act(async () => {
    byLabel(label).props.onPress();
  });
function pressable(text: string) {
  let node: Renderer.ReactTestInstance | null =
    tree.root
      .findAllByType(Text)
      .find(item => joined(item.props.children) === text) ?? null;
  while (node && typeof node.props.onPress !== 'function') node = node.parent;
  return node!;
}
const pressText = (text: string) =>
  act(async () => {
    await pressable(text).props.onPress();
  });
const input = (label: string) =>
  tree.root
    .findAllByType(TextInput)
    .find(node => node.props.accessibilityLabel === label)!;
const type = (label: string, value: string) =>
  act(async () => {
    input(label).props.onChangeText(value);
  });
const inputs = () => tree.root.findAllByType(TextInput).length;
// 마지막으로 뜬 확인 창에서 이름이 같은 버튼을 누른다
const choose = (title: string) =>
  act(async () => {
    const buttons = alert.mock.calls.at(-1)![2] as Array<{
      text: string;
      onPress?: () => void;
    }>;
    await buttons.find(button => button.text === title)!.onPress?.();
  });
const inDetail = (section: string) => !!byLabel(`${section}에서 뒤로`);

beforeEach(() => {
  jest.clearAllMocks();
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  mockSave.mockResolvedValue(undefined);
  mockPush.mockResolvedValue(true);
});
afterEach(async () => {
  alert.mockRestore();
  await act(async () => tree.unmount());
});

describe('the list', () => {
  test('lists each setting with its current value instead of spreading every field out', async () => {
    await render();
    expect(byLabel('내 프로필, 조현 · 달료')).toBeDefined();
    expect(byLabel('푸시 알림, 꺼짐')).toBeDefined();
    expect(byLabel('내 지역, 서울')).toBeDefined();
    expect(byLabel('달료 말투, 표준어')).toBeDefined();
    expect(inputs()).toBe(0);
    expect(tree.root.findAllByType(Switch)).toHaveLength(0);
    expect(texts()).toContain('로그아웃');
  });

  test('the back button on the list leaves settings', async () => {
    await render();
    await press('설정에서 뒤로');
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  test('the development-only preview entry is offered only when the app provides it', async () => {
    await render();
    expect(texts()).not.toContain('캐릭터 미리보기 (개발용)');
    await act(async () => tree.unmount());
    const preview = jest.fn();
    await render(preview);
    await pressText('캐릭터 미리보기 (개발용)');
    expect(preview).toHaveBeenCalledTimes(1);
  });
});

describe('opening one setting', () => {
  test('shows only that setting’s fields', async () => {
    await render();
    await press('내 프로필, 조현 · 달료');
    expect(inDetail('내 프로필')).toBe(true);
    expect(input('닉네임').props.value).toBe('조현');
    expect(input('캐릭터 이름').props.value).toBe('달료');
    expect(tree.root.findAllByType(Switch)).toHaveLength(0);
    expect(byLabel('부산')).toBeUndefined();
  });

  test('going back without changes returns to the list with no question', async () => {
    await render();
    await press('내 지역, 서울');
    expect(inDetail('내 지역')).toBe(true);
    await press('내 지역에서 뒤로');
    expect(inDetail('내 지역')).toBe(false);
    expect(byLabel('내 지역, 서울')).toBeDefined();
    expect(alert).not.toHaveBeenCalled();
  });

  test('the save button stays off until something changes', async () => {
    await render();
    await press('달료 말투, 표준어');
    expect(pressable('저장').props.disabled).toBe(true);
    const rows = tree.root.findAll(
      node =>
        node.props.accessibilityLabel === '경상도' &&
        typeof node.props.onPress === 'function',
    );
    await act(async () => rows[0].props.onPress());
    expect(pressable('저장').props.disabled).toBeFalsy();
  });
});

describe('leaving with unsaved changes', () => {
  test('asks first, and “keep editing” stays on the page with the edit', async () => {
    await render();
    await press('내 프로필, 조현 · 달료');
    await type('닉네임', '새닉네임');
    await press('내 프로필에서 뒤로');
    expect(alert).toHaveBeenCalledWith(
      '변경 내용을 저장하지 않았어요',
      '저장하지 않고 나갈까요?',
      expect.any(Array),
    );
    await choose('계속 수정');
    expect(inDetail('내 프로필')).toBe(true);
    expect(input('닉네임').props.value).toBe('새닉네임');
  });

  test('“leave” goes back and throws the edit away, so reopening shows the saved value', async () => {
    await render();
    await press('내 프로필, 조현 · 달료');
    await type('닉네임', '새닉네임');
    await press('내 프로필에서 뒤로');
    await choose('나가기');
    expect(inDetail('내 프로필')).toBe(false);
    expect(byLabel('내 프로필, 조현 · 달료')).toBeDefined();
    await press('내 프로필, 조현 · 달료');
    expect(input('닉네임').props.value).toBe('조현');
  });
});

describe('saving', () => {
  test('saves the edit, returns to the list, and shows the new value with a confirmation', async () => {
    await render();
    await press('내 프로필, 조현 · 달료');
    await type('닉네임', '새닉네임');
    await pressText('저장');
    expect(mockSave).toHaveBeenCalledTimes(1);
    const [form, petName, image, notifications] = mockSave.mock.calls[0];
    expect(form).toMatchObject({
      displayName: '새닉네임',
      region: '서울',
      dialect: 'std',
      height: '170',
      weight: '60',
    });
    expect(petName).toBe('달료');
    expect(image).toBeNull();
    expect(notifications).toMatchObject({ push: false, growth: true });
    expect(inDetail('내 프로필')).toBe(false);
    expect(byLabel('내 프로필, 새닉네임 · 달료')).toBeDefined();
    expect(texts()).toContain('설정을 저장했어요.');
  });

  test('a mistake in the form is explained on the same page and nothing is sent', async () => {
    await render();
    await press('내 프로필, 조현 · 달료');
    await type('닉네임', '');
    await pressText('저장');
    expect(mockSave).not.toHaveBeenCalled();
    expect(inDetail('내 프로필')).toBe(true);
    expect(
      tree.root.findAll(node => node.props.accessibilityRole === 'alert')
        .length,
    ).toBeGreaterThan(0);
  });

  test('a server failure keeps the page open with the edit so it can be tried again', async () => {
    mockSave.mockRejectedValueOnce(
      Object.assign(new Error('internal'), { code: 'functions/internal' }),
    );
    await render();
    await press('내 프로필, 조현 · 달료');
    await type('닉네임', '새닉네임');
    await pressText('저장');
    expect(inDetail('내 프로필')).toBe(true);
    expect(texts().join('|')).toContain('저장하지 못했어요');
    expect(input('닉네임').props.value).toBe('새닉네임');
    await pressText('저장');
    expect(mockSave).toHaveBeenCalledTimes(2);
    expect(inDetail('내 프로필')).toBe(false);
  });

  test('saving one setting does not carry an edit that was thrown away from another', async () => {
    await render();
    await press('내 프로필, 조현 · 달료');
    await type('닉네임', '버릴이름');
    await press('내 프로필에서 뒤로');
    await choose('나가기');
    await press('내 지역, 서울');
    await act(async () => byLabel('부산').props.onPress());
    await pressText('저장');
    expect(mockSave.mock.calls[0][0]).toMatchObject({
      displayName: '조현',
      region: '부산',
    });
    expect(byLabel('내 지역, 부산')).toBeDefined();
  });

  test('a new photo is uploaded first and its address is saved', async () => {
    mockChoose.mockResolvedValue({
      uri: 'file:///photo.jpg',
      type: 'image/jpeg',
    });
    mockUpload.mockResolvedValue({ url: 'https://img.example/me.jpg' });
    await render();
    await press('내 프로필, 조현 · 달료');
    await press('프로필 사진 변경');
    await choose('앨범에서 선택');
    expect(mockChoose).toHaveBeenCalledWith(false);
    await pressText('저장');
    expect(mockUpload).toHaveBeenCalledWith(
      { uri: 'file:///photo.jpg', type: 'image/jpeg' },
      'profiles',
      expect.any(Function),
    );
    expect(mockSave.mock.calls[0][2]).toBe('https://img.example/me.jpg');
  });
});

describe('push notifications', () => {
  const sub = () => tree.root.findAllByType(Switch);

  test('the detail shows the four switches, and the others are locked while push is off', async () => {
    await render();
    await press('푸시 알림, 꺼짐');
    expect(sub()).toHaveLength(4);
    const [push, growth, social, stone] = sub();
    expect(push.props.disabled).toBeFalsy();
    expect([growth, social, stone].every(item => item.props.disabled)).toBe(
      true,
    );
  });

  test('turning push on asks for the device permission; if refused it is explained and not saved', async () => {
    mockPush.mockResolvedValue(false);
    await render();
    await press('푸시 알림, 꺼짐');
    await act(async () => sub()[0].props.onValueChange(true));
    await pressText('저장');
    expect(texts().join('|')).toContain(
      '기기 설정에서 달료 알림을 허용해 주세요.',
    );
    expect(mockSave).not.toHaveBeenCalled();
    expect(inDetail('푸시 알림')).toBe(true);
  });

  test('when allowed it is saved and the list says on', async () => {
    await render();
    await press('푸시 알림, 꺼짐');
    await act(async () => sub()[0].props.onValueChange(true));
    await pressText('저장');
    expect(mockSave.mock.calls[0][3]).toMatchObject({ push: true });
    expect(byLabel('푸시 알림, 켜짐')).toBeDefined();
  });
});

describe('dialect', () => {
  test('shows a sample line in the chosen dialect before saving, and the list shows the saved one', async () => {
    await render();
    await press('달료 말투, 표준어');
    await act(async () => byLabel('경상도').props.onPress());
    expect(texts()).toContain('오늘도 같이 달리자 아이가!');
    // 목록은 아래에 그대로 있고, 저장하기 전까지는 저장된 값을 보여 준다
    expect(byLabel('달료 말투, 표준어')).toBeDefined();
    await pressText('저장');
    expect(mockSave.mock.calls[0][0]).toMatchObject({ dialect: 'gyeong' });
    expect(byLabel('달료 말투, 경상도')).toBeDefined();
  });
});

describe('logging out', () => {
  test('is on the list and asks first', async () => {
    await render();
    await pressText('로그아웃');
    expect(alert).toHaveBeenCalledWith(
      '로그아웃할까요?',
      expect.any(String),
      expect.any(Array),
    );
    expect(mockSignOut).not.toHaveBeenCalled();
    await choose('로그아웃');
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});

describe('the user id', () => {
  const withId = { ...user, user_id: 'dalryo_jo' } as UserDocument;
  async function renderAs(current: UserDocument) {
    await act(async () => {
      tree = Renderer.create(<SettingsScreen user={current} onBack={onBack} />);
    });
  }

  test('is on the profile page, empty for someone who has none yet', async () => {
    await render();
    await press('내 프로필, 조현 · 달료');
    expect(input('아이디').props.value).toBe('');
    await act(async () => tree.unmount());
    await renderAs(withId);
    await press('내 프로필, 조현 · 달료');
    expect(input('아이디').props.value).toBe('dalryo_jo');
  });

  test('is sent lower-cased with the rest of the profile', async () => {
    await render();
    await press('내 프로필, 조현 · 달료');
    await type('아이디', 'Run_Jo');
    expect(input('아이디').props.value).toBe('run_jo');
    await pressText('저장');
    expect(mockSave.mock.calls[0][0]).toMatchObject({ userId: 'run_jo' });
  });

  test('a badly formed id is explained and nothing is sent', async () => {
    await render();
    await press('내 프로필, 조현 · 달료');
    await type('아이디', 'a b');
    await pressText('저장');
    expect(mockSave).not.toHaveBeenCalled();
    expect(texts().some(text => text.includes('아이디는 영문 소문자'))).toBe(
      true,
    );
  });

  test('once it is set it cannot be emptied', async () => {
    await renderAs(withId);
    await press('내 프로필, 조현 · 달료');
    await type('아이디', '');
    await pressText('저장');
    expect(mockSave).not.toHaveBeenCalled();
    expect(texts().some(text => text.includes('아이디는 비울 수 없어요'))).toBe(
      true,
    );
  });

  test('leaving it untouched for someone with no id yet still saves the other changes', async () => {
    await render();
    await press('내 프로필, 조현 · 달료');
    await type('닉네임', '새닉네임');
    await pressText('저장');
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSave.mock.calls[0][0].userId ?? '').toBe('');
  });
});

describe('saved posts', () => {
  test('are reached from the list when the app provides the entry', async () => {
    const onOpenSaved = jest.fn();
    await act(async () => {
      tree = Renderer.create(
        <SettingsScreen
          user={user}
          onBack={onBack}
          onOpenSaved={onOpenSaved}
        />,
      );
    });
    await press('저장한 게시물');
    expect(onOpenSaved).toHaveBeenCalledTimes(1);
    expect(texts()).toContain('북마크한 게시물을 모아 봐요');
  });

  test('are not offered when nothing handles them', async () => {
    await render();
    expect(byLabel('저장한 게시물')).toBeUndefined();
  });
});

describe('blocked users', () => {
  test('are reached from the list when the app provides the entry', async () => {
    const onOpenBlocked = jest.fn();
    await act(async () => {
      tree = Renderer.create(
        <SettingsScreen
          user={user}
          onBack={onBack}
          onOpenBlocked={onOpenBlocked}
        />,
      );
    });
    await press('차단한 사용자');
    expect(onOpenBlocked).toHaveBeenCalledTimes(1);
  });

  test('are not offered when nothing handles them', async () => {
    await render();
    expect(byLabel('차단한 사용자')).toBeUndefined();
  });
});

describe('opening straight on the profile item', () => {
  async function renderDirect() {
    await act(async () => {
      tree = Renderer.create(
        <SettingsScreen user={user} onBack={onBack} initialSection="profile" />,
      );
    });
  }

  test('shows the profile fields first, without the list behind them', async () => {
    await renderDirect();
    expect(inDetail('내 프로필')).toBe(true);
    expect(input('닉네임').props.value).toBe('조현');
    expect(byLabel('푸시 알림, 꺼짐')).toBeUndefined();
    expect(byLabel('설정에서 뒤로')).toBeUndefined();
  });

  test('going back leaves settings entirely, so the profile it came from is shown again', async () => {
    await renderDirect();
    await press('내 프로필에서 뒤로');
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  test('an unsaved change still asks first, and leaving then closes settings', async () => {
    await renderDirect();
    await type('닉네임', '바꾼닉네임');
    await press('내 프로필에서 뒤로');
    expect(onBack).not.toHaveBeenCalled();
    await choose('나가기');
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  test('saving closes settings too, and sends the edit', async () => {
    await renderDirect();
    await type('닉네임', '새닉네임');
    await pressText('저장');
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSave.mock.calls[0][0]).toMatchObject({
      displayName: '새닉네임',
    });
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
